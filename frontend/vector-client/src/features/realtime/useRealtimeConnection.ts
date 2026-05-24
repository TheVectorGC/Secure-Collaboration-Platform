import { useEffect, useRef } from 'react';
import { serviceUrls } from '../../shared/config/serviceUrls';
import { getChats } from '../chats/api/chatsApi';
import type {
  ChatUpdatedPayload,
  DocumentChangedPayload,
  MessageCreatedPayload,
  MessageDeliveredPayload,
  MessageReadPayload,
  MessageReactionUpdatedPayload,
  GroupEpochKeysAvailablePayload,
  MessageResponseDto,
  PresenceSnapshotPayload,
  ProfileUpdatedPayload,
  DeviceRevokedPayload,
  RealtimeEventDto,
  TypingPayload,
  AccountPresencePayload,
} from '../../shared/types/api';

import { refreshAuthenticationToken } from '../auth/api/authApi';
import { getChatMessages } from '../messages/api/messagesApi';
import { forgetRememberedDeviceIdsForProfile, useAuthStore } from '../auth/model/authStore';
import { useMessengerStore } from '../messenger/model/messengerStore';
import { useRealtimeStore } from './model/realtimeStore';
import { useDirectoryStore } from '../directory/model/directoryStore';
import { clientLogger } from '../../shared/lib/clientLogger';

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;

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

function isMessageReactionUpdatedPayload(payload: unknown): payload is MessageReactionUpdatedPayload {
  return isObjectPayload(payload)
    && typeof payload.chatId === 'string'
    && typeof payload.messageId === 'string'
    && typeof payload.accountId === 'string'
    && (typeof payload.emoji === 'string' || payload.emoji === null)
    && typeof payload.updatedAt === 'string';
}

function isGroupEpochKeysAvailablePayload(payload: unknown): payload is GroupEpochKeysAvailablePayload {
  return isObjectPayload(payload)
    && typeof payload.chatId === 'string'
    && typeof payload.epoch === 'number'
    && typeof payload.targetAccountId === 'string';
}

function isDeviceRevokedPayload(payload: unknown): payload is DeviceRevokedPayload {
  return isObjectPayload(payload)
    && typeof payload.accountId === 'string'
    && typeof payload.deviceId === 'string';
}


function isDocumentChangedPayload(payload: unknown): payload is DocumentChangedPayload {
  return isObjectPayload(payload)
    && typeof payload.documentId === 'string'
    && (
      typeof payload.document === 'undefined'
      || payload.document === null
      || (isObjectPayload(payload.document) && typeof payload.document.documentId === 'string')
    );
}

function isDocumentEventType(eventType: string): boolean {
  return eventType === 'DOCUMENT_CREATED'
    || eventType === 'DOCUMENT_UPDATED'
    || eventType === 'DOCUMENT_SIGNED'
    || eventType === 'DOCUMENT_REJECTED'
    || eventType === 'DOCUMENT_CANCELLED'
    || eventType === 'DOCUMENT_HIDDEN'
    || eventType === 'DOCUMENT_OBSERVERS_ADDED';
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

function isProfileUpdatedPayload(payload: unknown): payload is ProfileUpdatedPayload {
  return isObjectPayload(payload)
    && typeof payload.accountId === 'string'
    && typeof payload.username === 'string'
    && typeof payload.email === 'string';
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
  const upsertMessage = useMessengerStore((state) => state.upsertMessage);
  const upsertChat = useMessengerStore((state) => state.upsertChat);
  const setChats = useMessengerStore((state) => state.setChats);
  const setMessages = useMessengerStore((state) => state.setMessages);
  const touchChat = useMessengerStore((state) => state.touchChat);
  const applyMessageDelivered = useMessengerStore((state) => state.applyMessageDelivered);
  const applyMessageRead = useMessengerStore((state) => state.applyMessageRead);
  const applyMessageReaction = useMessengerStore((state) => state.applyMessageReaction);
  const setStatus = useRealtimeStore((state) => state.setStatus);
  const setLastError = useRealtimeStore((state) => state.setLastError);
  const setTyping = useRealtimeStore((state) => state.setTyping);
  const setPresence = useRealtimeStore((state) => state.setPresence);
  const applyPresenceSnapshot = useRealtimeStore((state) => state.applyPresenceSnapshot);
  const setTypingSender = useRealtimeStore((state) => state.setTypingSender);
  const upsertProfile = useDirectoryStore((state) => state.upsertProfile);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const heartbeatTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setTypingSender((request) => {
      const webSocket = webSocketRef.current;

      if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      webSocket.send(JSON.stringify({
        type: 'TYPING',
        chatId: request.chatId,
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

    function clearHeartbeatTimers() {
      if (heartbeatIntervalRef.current !== null) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (heartbeatTimeoutRef.current !== null) {
        window.clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
    }

    function sendHeartbeatPing() {
      if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
        return;
      }

      webSocket.send('ping');

      if (heartbeatTimeoutRef.current !== null) {
        window.clearTimeout(heartbeatTimeoutRef.current);
      }

      heartbeatTimeoutRef.current = window.setTimeout(() => {
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
          webSocket.close();
        }
      }, HEARTBEAT_TIMEOUT_MS);
    }

    function startHeartbeat() {
      clearHeartbeatTimers();
      sendHeartbeatPing();
      heartbeatIntervalRef.current = window.setInterval(sendHeartbeatPing, HEARTBEAT_INTERVAL_MS);
    }

    function markHeartbeatPongReceived() {
      if (heartbeatTimeoutRef.current !== null) {
        window.clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
    }


    async function synchronizeAfterReconnect() {
      try {
        const loadedChats = await getChats();
        setChats(loadedChats);
        const loadedChatIds = Object.keys(useMessengerStore.getState().messagesByChatId);

        await Promise.all(loadedChatIds.map(async (chatId) => {
          const loadedMessages = await getChatMessages(chatId);
          setMessages(chatId, loadedMessages);
        }));
      }
      catch (error) {
        clientLogger.warn('Realtime reconnect synchronization failed.', { error }, {
          dedupeKey: 'realtime-reconnect-sync',
          throttleMs: 30000,
        });
      }
    }

    function handleRealtimeEvent(realtimeEvent: RealtimeEventDto) {
      if (realtimeEvent.type === 'MESSAGE_CREATED' && isMessageCreatedPayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        const devicePayloads = payload.devicePayloads ?? [];
        const message: MessageResponseDto = {
          messageId: payload.messageId,
          chatId: payload.chatId,
          senderAccountId: payload.senderAccountId,
          senderDeviceId: payload.senderDeviceId,
          clientMessageId: payload.clientMessageId ?? null,
          messageType: payload.messageType,
          encryptionType: payload.encryptionType,
          encryptedPayload: payload.encryptedPayload ?? null,
          contentAlgorithm: payload.contentAlgorithm ?? null,
          contentInitializationVectorBase64: payload.contentInitializationVectorBase64 ?? null,
          contentAuthenticationTagBase64: payload.contentAuthenticationTagBase64 ?? null,
          groupKeyEpoch: payload.groupKeyEpoch ?? null,
          devicePayloads,
          accountKeyEnvelopes: payload.accountKeyEnvelopes ?? [],
          groupEpochKeyEnvelope: payload.groupEpochKeyEnvelope ?? null,
          createdAt: payload.createdAt,
          deliveryStates: [],
          reactions: [],
        };

        upsertMessage(message);
        touchChat(payload.chatId, payload.createdAt, payload.messageId);

        return;
      }

      if (realtimeEvent.type === 'CHAT_UPDATED' && isChatUpdatedPayload(realtimeEvent.payload)) {
        const chat = realtimeEvent.payload.chat;
        upsertChat(chat);
        return;
      }

      if (isDocumentEventType(realtimeEvent.type) && isDocumentChangedPayload(realtimeEvent.payload)) {
        window.dispatchEvent(new CustomEvent('vector:documentChanged', { detail: { documentId: realtimeEvent.payload.documentId, eventType: realtimeEvent.type } }));
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

      if (realtimeEvent.type === 'PROFILE_UPDATED' && isProfileUpdatedPayload(realtimeEvent.payload)) {
        upsertProfile(realtimeEvent.payload);
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

      if (realtimeEvent.type === 'MESSAGE_REACTION_UPDATED' && isMessageReactionUpdatedPayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        applyMessageReaction(payload.chatId, payload.messageId, payload.accountId, payload.emoji, payload.updatedAt);
        return;
      }

      if (realtimeEvent.type === 'GROUP_EPOCH_KEYS_AVAILABLE' && isGroupEpochKeysAvailablePayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        window.dispatchEvent(new CustomEvent('vector:groupEpochKeysAvailable', { detail: payload }));

        void getChatMessages(payload.chatId)
          .then((loadedMessages) => {
            setMessages(payload.chatId, loadedMessages);
            window.dispatchEvent(new CustomEvent('vector:groupEpochKeysAvailable', { detail: payload }));
          })
          .catch((error) => {
            clientLogger.warn('Failed to refresh group messages after group keys became available.', {
              chatId: payload.chatId,
              epoch: payload.epoch,
              targetAccountId: payload.targetAccountId,
              error,
            }, {
              dedupeKey: `group-keys-message-refresh:${payload.chatId}:${payload.epoch}:${payload.targetAccountId}`,
              throttleMs: 30000,
            });
          });

        return;
      }

      if (realtimeEvent.type === 'DEVICE_REVOKED' && isDeviceRevokedPayload(realtimeEvent.payload)) {
        const currentDeviceId = useAuthStore.getState().deviceId;

        if (realtimeEvent.payload.deviceId === currentDeviceId) {
          forgetRememberedDeviceIdsForProfile(useAuthStore.getState().profile);
          useAuthStore.getState().clearAuthentication({ rememberDevice: false });
        }

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
        clientLogger.error('Realtime token refresh failed.', { error }, {
          dedupeKey: 'realtime-token-refresh',
          throttleMs: 30000,
        });
        setLastError('Не удалось обновить realtime-сессию.');
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
        const wasReconnect = reconnectAttemptRef.current > 0;
        reconnectAttemptRef.current = 0;
        setStatus('connected');
        setLastError(null);
        startHeartbeat();

        if (wasReconnect) {
          void synchronizeAfterReconnect();
        }
      };

      webSocket.onmessage = (event) => {
        if (event.data === 'pong') {
          markHeartbeatPongReceived();
          return;
        }

        try {
          const realtimeEvent = JSON.parse(event.data) as RealtimeEventDto;
          handleRealtimeEvent(realtimeEvent);
        }
        catch (error) {
          clientLogger.error('Realtime event parsing failed.', { error, rawEvent: event.data }, {
            dedupeKey: 'realtime-event-parse',
            throttleMs: 30000,
          });
          setLastError('Не удалось обработать realtime событие.');
        }
      };

      webSocket.onerror = () => {
        setLastError('Ошибка realtime-соединения.');
      };

      webSocket.onclose = (event) => {
        if (webSocketRef.current === webSocket) {
          webSocketRef.current = null;
        }

        clearHeartbeatTimers();

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
          clientLogger.error('Scheduled realtime token refresh failed.', { error }, {
            dedupeKey: 'realtime-scheduled-token-refresh',
            throttleMs: 30000,
          });
          setLastError('Не удалось обновить realtime-сессию.');
        }
      }, refreshDelay);
    }

    return () => {
      isClosedByEffect = true;
      clearReconnectTimeout();
      clearHeartbeatTimers();

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
    applyMessageDelivered,
    applyMessageRead,
    applyMessageReaction,
    applyPresenceSnapshot,
    setLastError,
    setChats,
    setMessages,
    setPresence,
    setStatus,
    setTyping,
    touchChat,
    upsertChat,
    upsertMessage,
    upsertProfile,
  ]);
}
