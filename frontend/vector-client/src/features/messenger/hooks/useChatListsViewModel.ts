import { useMemo } from 'react';
import type { ChatResponseDto, MessageResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import { getChatPresentation, getLastTimelineMessage } from '../lib/messengerCore';

type UseChatListsViewModelParams = {
  chats: ChatResponseDto[];
  messagesByChatId: Record<string, MessageResponseDto[]>;
  hiddenChatIdSet: Set<string>;
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

    if (!normalizedQuery) {
      return visibleChats;
    }

    return visibleChats.filter((chat) => {
      const presentation = getChatPresentation(chat, currentProfile, profilesById);
      return `${presentation.title} ${presentation.subtitle}`.toLowerCase().includes(normalizedQuery);
    });
  }, [chatSearchQuery, chats, hiddenChatIdSet, messagesByChatId, currentProfile, profilesById]);

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
