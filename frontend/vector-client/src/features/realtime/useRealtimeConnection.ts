import { useEffect, useRef } from 'react';
import { serviceUrls } from '../../shared/config/serviceUrls';
import type {
  ChatUpdatedPayload,
  MessageCreatedPayload,
  MessageDeliveredPayload,
  MessageReadPayload,
  MessageResponseDto,
  PresenceSnapshotPayload,
  RealtimeEventDto,
  TypingPayload,
  AccountPresencePayload,
} from '../../shared/types/api';
import { refreshAuthenticationToken } from '../auth/api/authApi';
import { getChatMessages } from '../messages/api/messagesApi';
import { useAuthStore } from '../auth/model/authStore';
import { useMessengerStore } from '../messenger/model/messengerStore';
import { useRealtimeStore } from './model/realtimeStore';

function isObjectPayload(payload: unknown): payload is Record<string, unknown> {
  return Boolean(payload) && typeof payload === 'object';
}

function isMessageCreatedPayload(payload: unknown): payload is MessageCreatedPayload {
  return isObjectPayload(payload)
    && typeof payload.chatId === 'string'
    && typeof payload.messageId === 'string'
    && typeof payload.senderAccountId === 'string'
    && typeof payload.senderDeviceId === 'string'
    && typeof payload.messageType === 'string'
    && typeof payload.encryptionType === 'string'
    && (
      typeof payload.encryptedPayload === 'string'
      || payload.encryptedPayload === null
      || Array.isArray(payload.devicePayloads)
    );
}

function isChatUpdatedPayload(payload: unknown): payload is ChatUpdatedPayload {
  return isObjectPayload(payload)
    && isObjectPayload(payload.chat)
    && typeof payload.chat.chatId === 'string'
    && typeof payload.chat.type === 'string'
    && Array.isArray(payload.chat.participantAccountIds)
    && Array.isArray(payload.chat.participants);
}

function isMessageDeliveredPayload(payload: unknown): payload is MessageDeliveredPayload {
  return isObjectPayload(payload)
    && typeof payload.chatId === 'string'
    && typeof payload.messageId === 'string'
    && typeof payload.deliveredByAccountId === 'string';
}

function isMessageReadPayload(payload: unknown): payload is MessageReadPayload {
  return isObjectPayload(payload)
    && typeof payload.chatId === 'string'
    && typeof payload.lastReadMessageId === 'string'
    && Array.isArray(payload.readMessageIds)
    && payload.readMessageIds.every((messageId) => typeof messageId === 'string')
    && typeof payload.readByAccountId === 'string'
    && typeof payload.readAt === 'string';
}

function isTypingPayload(payload: unknown): payload is TypingPayload {
  return isObjectPayload(payload)
    && typeof payload.chatId === 'string'
    && typeof payload.typingAccountId === 'string'
    && typeof payload.username === 'string'
    && typeof payload.isTyping === 'boolean';
}

function isAccountPresencePayload(payload: unknown): payload is AccountPresencePayload {
  return isObjectPayload(payload)
    && typeof payload.accountId === 'string'
    && typeof payload.online === 'boolean'
    && (typeof payload.lastSeenAt === 'string' || payload.lastSeenAt === null);
}

function isPresenceSnapshotPayload(payload: unknown): payload is PresenceSnapshotPayload {
  return isObjectPayload(payload)
    && Array.isArray(payload.accounts)
    && payload.accounts.every(isAccountPresencePayload);
}

function getAccessTokenExpirationTime(accessTokenExpiresAt: string | null): number | null {
  if (!accessTokenExpiresAt) {
    return null;
  }

  const expirationTime = new Date(accessTokenExpiresAt).getTime();

  if (Number.isNaN(expirationTime)) {
    return null;
  }

  return expirationTime;
}

function shouldRefreshBeforeConnecting(accessTokenExpiresAt: string | null): boolean {
  const expirationTime = getAccessTokenExpirationTime(accessTokenExpiresAt);

  if (expirationTime === null) {
    return false;
  }

  return expirationTime - Date.now() <= 30_000;
}

function calculateRefreshDelay(accessTokenExpiresAt: string | null): number | null {
  const expirationTime = getAccessTokenExpirationTime(accessTokenExpiresAt);

  if (expirationTime === null) {
    return null;
  }

  const refreshTime = expirationTime - 60_000;
  const delay = refreshTime - Date.now();

  return Math.max(delay, 5_000);
}

export function useRealtimeConnection() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const accessTokenExpiresAt = useAuthStore((state) => state.accessTokenExpiresAt);
  const currentDeviceId = useAuthStore((state) => state.deviceId);
  const selectedChatId = useMessengerStore((state) => state.selectedChatId);
  const upsertMessage = useMessengerStore((state) => state.upsertMessage);
  const upsertChat = useMessengerStore((state) => state.upsertChat);
  const setMessages = useMessengerStore((state) => state.setMessages);
  const touchChat = useMessengerStore((state) => state.touchChat);
  const applyMessageDelivered = useMessengerStore((state) => state.applyMessageDelivered);
  const applyMessageRead = useMessengerStore((state) => state.applyMessageRead);
  const setStatus = useRealtimeStore((state) => state.setStatus);
  const setLastError = useRealtimeStore((state) => state.setLastError);
  const setTyping = useRealtimeStore((state) => state.setTyping);
  const setPresence = useRealtimeStore((state) => state.setPresence);
  const applyPresenceSnapshot = useRealtimeStore((state) => state.applyPresenceSnapshot);
  const setTypingSender = useRealtimeStore((state) => state.setTypingSender);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setTypingSender((request) => {
      const webSocket = webSocketRef.current;

      if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      webSocket.send(JSON.stringify({
        type: 'TYPING',
        chatId: request.chatId,
        recipientAccountIds: request.recipientAccountIds,
        isTyping: request.isTyping,
      }));
    });

    return () => setTypingSender(null);
  }, [setTypingSender]);

  useEffect(() => {
    if (!accessToken) {
      setStatus('disconnected');
      webSocketRef.current = null;
      return;
    }

    const activeAccessToken = accessToken;
    let webSocket: WebSocket | null = null;
    let isClosedByEffect = false;
    let isRefreshingBeforeConnect = false;

    function clearReconnectTimeout() {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }

    function refreshChatMessages(chatId: string) {
      getChatMessages(chatId)
        .then((messages) => {
          setMessages(chatId, messages);
        })
        .catch((error) => {
          console.warn('Failed to refresh chat messages after realtime update.', error);
        });
    }

    function handleRealtimeEvent(realtimeEvent: RealtimeEventDto) {
      if (realtimeEvent.type === 'MESSAGE_CREATED' && isMessageCreatedPayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        const devicePayloads = payload.devicePayloads ?? [];
        const currentDevicePayload = devicePayloads.find((devicePayload) => devicePayload.targetDeviceId === currentDeviceId);
        const message: MessageResponseDto = {
          messageId: payload.messageId,
          chatId: payload.chatId,
          senderAccountId: payload.senderAccountId,
          senderDeviceId: payload.senderDeviceId,
          clientMessageId: null,
          messageType: payload.messageType,
          encryptionType: payload.encryptionType,
          encryptedPayload: payload.encryptedPayload ?? currentDevicePayload?.encryptedPayload ?? null,
          devicePayloads,
          createdAt: payload.createdAt,
          deliveryStates: [],
        };

        upsertMessage(message);
        touchChat(payload.chatId, payload.createdAt, payload.messageId);

        if (selectedChatId === payload.chatId) {
          refreshChatMessages(payload.chatId);
        }

        return;
      }

      if (realtimeEvent.type === 'CHAT_UPDATED' && isChatUpdatedPayload(realtimeEvent.payload)) {
        const chat = realtimeEvent.payload.chat;
        upsertChat(chat);
        refreshChatMessages(chat.chatId);
        return;
      }


      if (realtimeEvent.type === 'PRESENCE_UPDATED' && isAccountPresencePayload(realtimeEvent.payload)) {
        setPresence(realtimeEvent.payload);
        return;
      }

      if (realtimeEvent.type === 'PRESENCE_SNAPSHOT' && isPresenceSnapshotPayload(realtimeEvent.payload)) {
        applyPresenceSnapshot(realtimeEvent.payload.accounts);
        return;
      }

      if (realtimeEvent.type === 'MESSAGE_DELIVERED' && isMessageDeliveredPayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        applyMessageDelivered(payload.chatId, payload.messageId, payload.deliveredByAccountId, payload.deliveredAt);
        return;
      }

      if (realtimeEvent.type === 'MESSAGE_READ' && isMessageReadPayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        applyMessageRead(payload.chatId, payload.lastReadMessageId, payload.readMessageIds, payload.readByAccountId, payload.readAt);
        return;
      }

      if (realtimeEvent.type === 'TYPING' && isTypingPayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        setTyping(payload.chatId, payload.typingAccountId, payload.username, payload.isTyping);
      }
    }

    async function refreshBeforeReconnect() {
      if (isRefreshingBeforeConnect) {
        return;
      }

      isRefreshingBeforeConnect = true;
      setStatus('reconnecting');

      try {
        await refreshAuthenticationToken();
      }
      catch (error) {
        console.error(error);
        setLastError('Failed to refresh realtime token.');
      }
      finally {
        isRefreshingBeforeConnect = false;
      }
    }

    function connect() {
      clearReconnectTimeout();
      setStatus(reconnectAttemptRef.current === 0 ? 'connecting' : 'reconnecting');

      const webSocketUrl = `${serviceUrls.realtimeWebSocketUrl}?accessToken=${encodeURIComponent(activeAccessToken)}`;
      webSocket = new WebSocket(webSocketUrl);
      webSocketRef.current = webSocket;

      webSocket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setStatus('connected');
        setLastError(null);
        webSocket?.send('ping');
      };

      webSocket.onmessage = (event) => {
        if (event.data === 'pong') {
          return;
        }

        try {
          const realtimeEvent = JSON.parse(event.data) as RealtimeEventDto;
          handleRealtimeEvent(realtimeEvent);
        }
        catch (error) {
          console.error('Failed to parse realtime event.', error);
          setLastError('Не удалось обработать realtime событие.');
        }
      };

      webSocket.onerror = () => {
        setLastError('Realtime connection error.');
      };

      webSocket.onclose = (event) => {
        if (webSocketRef.current === webSocket) {
          webSocketRef.current = null;
        }

        if (isClosedByEffect) {
          setStatus('disconnected');
          return;
        }

        if (event.code === 1008) {
          void refreshBeforeReconnect();
          return;
        }

        reconnectAttemptRef.current += 1;
        setStatus('reconnecting');
        const reconnectDelay = Math.min(1000 * reconnectAttemptRef.current, 5000);
        reconnectTimeoutRef.current = window.setTimeout(connect, reconnectDelay);
      };
    }

    if (shouldRefreshBeforeConnecting(accessTokenExpiresAt)) {
      void refreshBeforeReconnect();
    }
    else {
      connect();
    }

    const refreshDelay = calculateRefreshDelay(accessTokenExpiresAt);

    if (refreshDelay !== null) {
      refreshTimeoutRef.current = window.setTimeout(async () => {
        try {
          await refreshAuthenticationToken();
        }
        catch (error) {
          console.error(error);
          setLastError('Failed to refresh realtime token.');
        }
      }, refreshDelay);
    }

    return () => {
      isClosedByEffect = true;
      clearReconnectTimeout();

      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      if (webSocket && webSocket.readyState !== WebSocket.CLOSED) {
        webSocket.close();
      }

      if (webSocketRef.current === webSocket) {
        webSocketRef.current = null;
      }
    };
  }, [
    accessToken,
    accessTokenExpiresAt,
    currentDeviceId,
    selectedChatId,
    applyMessageDelivered,
    applyMessageRead,
    applyPresenceSnapshot,
    setLastError,
    setMessages,
    setPresence,
    setStatus,
    setTyping,
    touchChat,
    upsertChat,
    upsertMessage,
  ]);
}
