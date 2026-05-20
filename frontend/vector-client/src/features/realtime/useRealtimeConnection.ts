import { useEffect, useRef } from 'react';
import { serviceUrls } from '../../shared/config/serviceUrls';
import type {
  MessageCreatedPayload,
  MessageDeliveredPayload,
  MessageReadPayload,
  MessageResponseDto,
  RealtimeEventDto,
  TypingPayload,
} from '../../shared/types/api';
import { refreshAuthenticationToken } from '../auth/api/authApi';
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
    && typeof payload.readByAccountId === 'string';
}

function isTypingPayload(payload: unknown): payload is TypingPayload {
  return isObjectPayload(payload)
    && typeof payload.chatId === 'string'
    && typeof payload.typingAccountId === 'string'
    && typeof payload.username === 'string'
    && typeof payload.isTyping === 'boolean';
}

function calculateRefreshDelay(accessTokenExpiresAt: string | null): number | null {
  if (!accessTokenExpiresAt) {
    return null;
  }

  const expirationTime = new Date(accessTokenExpiresAt).getTime();
  const refreshTime = expirationTime - 60_000;
  const delay = refreshTime - Date.now();

  return Math.max(delay, 5_000);
}

export function useRealtimeConnection() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const accessTokenExpiresAt = useAuthStore((state) => state.accessTokenExpiresAt);
  const currentDeviceId = useAuthStore((state) => state.deviceId);
  const upsertMessage = useMessengerStore((state) => state.upsertMessage);
  const touchChat = useMessengerStore((state) => state.touchChat);
  const applyMessageDelivered = useMessengerStore((state) => state.applyMessageDelivered);
  const applyMessageRead = useMessengerStore((state) => state.applyMessageRead);
  const setStatus = useRealtimeStore((state) => state.setStatus);
  const setLastError = useRealtimeStore((state) => state.setLastError);
  const setTyping = useRealtimeStore((state) => state.setTyping);
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

    function clearReconnectTimeout() {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
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
        return;
      }

      if (realtimeEvent.type === 'MESSAGE_DELIVERED' && isMessageDeliveredPayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        applyMessageDelivered(payload.chatId, payload.messageId, payload.deliveredByAccountId, payload.deliveredAt);
        return;
      }

      if (realtimeEvent.type === 'MESSAGE_READ' && isMessageReadPayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        applyMessageRead(payload.chatId, payload.lastReadMessageId, payload.readByAccountId, payload.readAt);
        return;
      }

      if (realtimeEvent.type === 'TYPING' && isTypingPayload(realtimeEvent.payload)) {
        const payload = realtimeEvent.payload;
        setTyping(payload.chatId, payload.typingAccountId, payload.username, payload.isTyping);
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

      webSocket.onclose = () => {
        if (webSocketRef.current === webSocket) {
          webSocketRef.current = null;
        }

        if (isClosedByEffect) {
          setStatus('disconnected');
          return;
        }

        reconnectAttemptRef.current += 1;
        setStatus('reconnecting');
        const reconnectDelay = Math.min(1000 * reconnectAttemptRef.current, 5000);
        reconnectTimeoutRef.current = window.setTimeout(connect, reconnectDelay);
      };
    }

    connect();

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
    applyMessageDelivered,
    applyMessageRead,
    setLastError,
    setStatus,
    setTyping,
    touchChat,
    upsertMessage,
  ]);
}
