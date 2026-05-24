import { useMemo } from 'react';
import type { ChatResponseDto, MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import { getChatPresentation, getLastTimelineMessage, type LocalChatState } from '../lib/messengerCore';

type UseChatListsViewModelParams = {
  chats: ChatResponseDto[];
  messagesByChatId: Record<string, MessageResponseDto[]>;
  hiddenChatIdSet: Set<string>;
  localChatState: LocalChatState;
  chatSearchQuery: string;
  forwardChatPickerQuery: string;
  currentProfile: ProfileResponseDto | null;
  profilesById: Record<string, ProfileResponseDto>;
};

export function useChatListsViewModel(params: UseChatListsViewModelParams) {
  const {
    chats,
    messagesByChatId,
    hiddenChatIdSet,
    localChatState,
    chatSearchQuery,
    forwardChatPickerQuery,
    currentProfile,
    profilesById,
  } = params;

  const filteredChats = useMemo(() => {
    const normalizedQuery = chatSearchQuery.trim().toLowerCase();
    const visibleChats = chats.filter((chat) => {
      if (hiddenChatIdSet.has(chat.chatId)) {
        return false;
      }

      if (chat.type === 'DIRECT') {
        const chatMessages = messagesByChatId[chat.chatId] ?? [];
        const hasTimelineMessage = Boolean(getLastTimelineMessage(chatMessages));

        if (!chat.lastMessageId && !hasTimelineMessage) {
          return false;
        }
      }

      return true;
    });

    const pinnedChatIdSet = new Set(localChatState.pinnedChatIds ?? []);
    const sortedVisibleChats = [...visibleChats].sort((leftChat, rightChat) => {
      if (leftChat.type === 'SELF' && rightChat.type !== 'SELF') {
        return -1;
      }

      if (leftChat.type !== 'SELF' && rightChat.type === 'SELF') {
        return 1;
      }

      const leftPinned = pinnedChatIdSet.has(leftChat.chatId);
      const rightPinned = pinnedChatIdSet.has(rightChat.chatId);

      if (leftPinned && !rightPinned) {
        return -1;
      }

      if (!leftPinned && rightPinned) {
        return 1;
      }

      return 0;
    });

    if (!normalizedQuery) {
      return sortedVisibleChats;
    }

    return sortedVisibleChats.filter((chat) => {
      const presentation = getChatPresentation(chat, currentProfile, profilesById);
      return `${presentation.title} ${presentation.subtitle}`.toLowerCase().includes(normalizedQuery);
    });
  }, [chatSearchQuery, chats, hiddenChatIdSet, messagesByChatId, currentProfile, profilesById, localChatState.pinnedChatIds]);

  const forwardTargetChats = useMemo(() => {
    const normalizedQuery = forwardChatPickerQuery.trim().toLowerCase();

    return filteredChats.filter((chat) => {
      if (!normalizedQuery) {
        return true;
      }

      const presentation = getChatPresentation(chat, currentProfile, profilesById);
      return `${presentation.title} ${presentation.subtitle}`.toLowerCase().includes(normalizedQuery);
    });
  }, [filteredChats, forwardChatPickerQuery, currentProfile, profilesById]);

  return {
    filteredChats,
    forwardTargetChats,
  };
}
