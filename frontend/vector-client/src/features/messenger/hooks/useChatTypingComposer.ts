import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { ChatResponseDto } from '../../../shared/types/api';
import { getActiveGroupParticipantAccountIds } from '../lib/messengerCore';

type SendTypingEventRequest = {
  chatId: string;
  recipientAccountIds: string[];
  isTyping: boolean;
};

type UseChatTypingComposerParams = {
  selectedChat: ChatResponseDto | null;
  currentAccountId: string | undefined;
  isChatWritable: boolean;
  sendTypingEvent: (request: SendTypingEventRequest) => void;
  onSubmit: () => void;
};

export function useChatTypingComposer({
  selectedChat,
  currentAccountId,
  isChatWritable,
  sendTypingEvent,
  onSubmit,
}: UseChatTypingComposerParams) {
  const [messageText, setMessageText] = useState('');
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimeoutRef = useRef<number | null>(null);

  function sendCurrentTypingState(isTyping: boolean) {
    if (!selectedChat || !currentAccountId || selectedChat.type === 'SELF') {
      return;
    }

    if (!isChatWritable) {
      return;
    }

    const recipientAccountIds = getActiveGroupParticipantAccountIds(selectedChat).filter((participantAccountId) => participantAccountId !== currentAccountId);

    if (recipientAccountIds.length === 0) {
      return;
    }

    sendTypingEvent({
      chatId: selectedChat.chatId,
      recipientAccountIds,
      isTyping,
    });
  }

  function handleMessageTextChange(value: string) {
    if (!isChatWritable) {
      setMessageText('');
      sendCurrentTypingState(false);
      return;
    }

    setMessageText(value);

    const now = Date.now();

    if (value.trim().length === 0) {
      sendCurrentTypingState(false);
      return;
    }

    if (now - lastTypingSentAtRef.current > 1600) {
      lastTypingSentAtRef.current = now;
      sendCurrentTypingState(true);
    }

    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = window.setTimeout(() => {
      sendCurrentTypingState(false);
      typingStopTimeoutRef.current = null;
    }, 2000);
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  function appendEmojiToMessage(emoji: string) {
    setMessageText((previousValue) => `${previousValue}${emoji}`);
  }

  useEffect(() => {
    if (!isChatWritable) {
      setMessageText('');
      sendCurrentTypingState(false);
    }
  }, [isChatWritable, selectedChat?.chatId]);

  useEffect(() => () => {
    if (typingStopTimeoutRef.current) {
      window.clearTimeout(typingStopTimeoutRef.current);
    }
  }, []);

  return {
    messageText,
    setMessageText,
    sendCurrentTypingState,
    handleMessageTextChange,
    handleTextareaKeyDown,
    appendEmojiToMessage,
  };
}
