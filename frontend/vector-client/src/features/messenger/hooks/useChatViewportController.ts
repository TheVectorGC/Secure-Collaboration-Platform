import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { markChatRead } from '../../messages/api/messagesApi';
import type { MessageResponseDto } from '../../../shared/types/api';
import type { LocalChatState } from '../lib/messengerCore';
import { calculateUnreadCount, getLastTimelineMessage } from '../lib/messengerCore';

type UpdateLocalChatState = (updater: (previousValue: LocalChatState) => LocalChatState) => void;

type UseChatViewportControllerParams = {
  selectedChatId: string | null;
  currentAccountId: string | undefined;
  visibleSelectedMessages: MessageResponseDto[];
  localChatState: LocalChatState;
  isSelectedChatWritable: boolean;
  updateLocalChatState: UpdateLocalChatState;
  messagesEndRef: RefObject<HTMLDivElement>;
  messageElementRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  readMarkersRef: MutableRefObject<Set<string>>;
};

function isReadableIncomingMessage(message: MessageResponseDto, currentAccountId: string | undefined): boolean {
  return Boolean(currentAccountId)
    && message.senderAccountId !== currentAccountId
    && message.messageType !== 'SYSTEM'
   ;
}

function isNearTimelineBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 96;
}

export function useChatViewportController(params: UseChatViewportControllerParams) {
  const {
    selectedChatId,
    currentAccountId,
    visibleSelectedMessages,
    localChatState,
    isSelectedChatWritable,
    updateLocalChatState,
    messagesEndRef,
    messageElementRefs,
    readMarkersRef,
  } = params;

  const timelineScrollContainerRef = useRef<HTMLDivElement>(null);
  const visibleIncomingMessageIdsRef = useRef<Set<string>>(new Set());
  const previousChatIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const isTimelineAtBottomRef = useRef(true);
  const [isTimelineAtBottom, setIsTimelineAtBottom] = useState(true);

  const unreadIncomingCount = useMemo(() => {
    if (!selectedChatId) {
      return 0;
    }

    return calculateUnreadCount(visibleSelectedMessages, currentAccountId, localChatState.readAtByChatId[selectedChatId]);
  }, [currentAccountId, localChatState.readAtByChatId, selectedChatId, visibleSelectedMessages]);

  const isJumpToBottomVisible = Boolean(selectedChatId) && !isTimelineAtBottom && unreadIncomingCount > 0;

  const setTimelineAtBottom = useCallback((value: boolean) => {
    isTimelineAtBottomRef.current = value;
    setIsTimelineAtBottom(value);
  }, []);

  const refreshTimelineAtBottomState = useCallback(() => {
    const timelineScrollContainer = timelineScrollContainerRef.current;

    if (!timelineScrollContainer) {
      setTimelineAtBottom(true);
      return;
    }

    setTimelineAtBottom(isNearTimelineBottom(timelineScrollContainer));
  }, [setTimelineAtBottom]);

  const scrollTimelineToBottom = useCallback((behavior: ScrollBehavior) => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
      window.requestAnimationFrame(refreshTimelineAtBottomState);
    });
  }, [messagesEndRef, refreshTimelineAtBottomState]);

  const markMessageReadThrough = useCallback((message: MessageResponseDto) => {
    if (!selectedChatId || !currentAccountId || !isSelectedChatWritable || !isReadableIncomingMessage(message, currentAccountId)) {
      return;
    }

    updateLocalChatState((previousValue) => {
      const previousReadAt = previousValue.readAtByChatId[selectedChatId] ?? null;
      const previousReadAtTime = previousReadAt ? new Date(previousReadAt).getTime() : 0;
      const nextReadAtTime = new Date(message.createdAt).getTime();

      if (nextReadAtTime <= previousReadAtTime) {
        return previousValue;
      }

      return {
        ...previousValue,
        readAtByChatId: {
          ...previousValue.readAtByChatId,
          [selectedChatId]: message.createdAt,
        },
      };
    });

    const readMarker = `${selectedChatId}:${message.messageId}:read`;

    if (readMarkersRef.current.has(readMarker)) {
      return;
    }

    readMarkersRef.current.add(readMarker);
    markChatRead(selectedChatId, message.messageId).catch((error) => {
      console.error(error);
      readMarkersRef.current.delete(readMarker);
    });
  }, [currentAccountId, isSelectedChatWritable, readMarkersRef, selectedChatId, updateLocalChatState]);

  const markLatestVisibleIncomingMessageRead = useCallback(() => {
    if (!selectedChatId || !currentAccountId) {
      return;
    }

    const latestVisibleIncomingMessage = [...visibleSelectedMessages].reverse().find((message) => (
      visibleIncomingMessageIdsRef.current.has(message.messageId)
      && isReadableIncomingMessage(message, currentAccountId)
    ));

    if (latestVisibleIncomingMessage) {
      markMessageReadThrough(latestVisibleIncomingMessage);
    }
  }, [currentAccountId, markMessageReadThrough, selectedChatId, visibleSelectedMessages]);

  const handleTimelineScroll = useCallback(() => {
    refreshTimelineAtBottomState();
  }, [refreshTimelineAtBottomState]);

  const handleJumpToBottom = useCallback(() => {
    scrollTimelineToBottom('smooth');
  }, [scrollTimelineToBottom]);

  useLayoutEffect(() => {
    const lastTimelineMessage = getLastTimelineMessage(visibleSelectedMessages);
    const lastMessageId = lastTimelineMessage?.messageId ?? null;
    const previousChatId = previousChatIdRef.current;
    const previousLastMessageId = previousLastMessageIdRef.current;
    const didSelectedChatChange = previousChatId !== selectedChatId;
    const didLastMessageChange = previousLastMessageId !== lastMessageId;

    previousChatIdRef.current = selectedChatId;
    previousLastMessageIdRef.current = lastMessageId;

    if (!selectedChatId) {
      visibleIncomingMessageIdsRef.current.clear();
      setTimelineAtBottom(true);
      return;
    }

    if (didSelectedChatChange) {
      visibleIncomingMessageIdsRef.current.clear();
      setTimelineAtBottom(true);
      scrollTimelineToBottom('auto');
      return;
    }

    if (!didLastMessageChange || !lastTimelineMessage) {
      return;
    }

    const isOwnLastMessage = Boolean(currentAccountId) && lastTimelineMessage.senderAccountId === currentAccountId;

    if (isOwnLastMessage || isTimelineAtBottomRef.current) {
      scrollTimelineToBottom('auto');
    }
  }, [currentAccountId, scrollTimelineToBottom, selectedChatId, setTimelineAtBottom, visibleSelectedMessages]);

  useEffect(() => {
    if (!selectedChatId || !currentAccountId || !isSelectedChatWritable) {
      visibleIncomingMessageIdsRef.current.clear();
      return;
    }

    const timelineScrollContainer = timelineScrollContainerRef.current;

    if (!timelineScrollContainer) {
      return;
    }

    const incomingMessages = visibleSelectedMessages.filter((message) => isReadableIncomingMessage(message, currentAccountId));
    const messageIdsByElement = new Map<Element, string>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const messageId = messageIdsByElement.get(entry.target);

        if (!messageId) {
          return;
        }

        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          visibleIncomingMessageIdsRef.current.add(messageId);
        }
        else {
          visibleIncomingMessageIdsRef.current.delete(messageId);
        }
      });

      markLatestVisibleIncomingMessageRead();
    }, {
      root: timelineScrollContainer,
      threshold: [0, 0.25, 0.6, 1],
    });

    incomingMessages.forEach((message) => {
      const messageElement = messageElementRefs.current[message.messageId];

      if (!messageElement) {
        return;
      }

      messageIdsByElement.set(messageElement, message.messageId);
      observer.observe(messageElement);
    });

    window.requestAnimationFrame(markLatestVisibleIncomingMessageRead);

    return () => {
      observer.disconnect();
      messageIdsByElement.forEach((messageId) => visibleIncomingMessageIdsRef.current.delete(messageId));
    };
  }, [currentAccountId, isSelectedChatWritable, markLatestVisibleIncomingMessageRead, messageElementRefs, selectedChatId, visibleSelectedMessages]);

  return {
    timelineScrollContainerRef,
    unreadIncomingCount,
    isJumpToBottomVisible,
    handleTimelineScroll,
    handleJumpToBottom,
  };
}
