import { create } from 'zustand';
import type { ChatResponseDto, MessageResponseDto } from '../../../shared/types/api';

function getChatSortTimestamp(chat: ChatResponseDto): number {
  return new Date(chat.lastMessageCreatedAt ?? chat.updatedAt ?? chat.createdAt).getTime();
}

function sortChats(chats: ChatResponseDto[]): ChatResponseDto[] {
  return [...chats].sort((left, right) => {
    if (left.type === 'SELF' && right.type !== 'SELF') {
      return -1;
    }

    if (left.type !== 'SELF' && right.type === 'SELF') {
      return 1;
    }

    return getChatSortTimestamp(right) - getChatSortTimestamp(left);
  });
}

function sortMessages(messages: MessageResponseDto[]): MessageResponseDto[] {
  return [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

type MessengerState = {
  chats: ChatResponseDto[];
  selectedChatId: string | null;
  messagesByChatId: Record<string, MessageResponseDto[]>;
  setChats: (chats: ChatResponseDto[]) => void;
  upsertChat: (chat: ChatResponseDto) => void;
  touchChat: (chatId: string, occurredAt: string, messageId?: string | null) => void;
  selectChat: (chatId: string) => void;
  setMessages: (chatId: string, messages: MessageResponseDto[]) => void;
  upsertMessage: (message: MessageResponseDto) => void;
  applyMessageDelivered: (chatId: string, messageId: string, accountId: string, deliveredAt: string) => void;
  applyMessageRead: (chatId: string, lastReadMessageId: string, accountId: string, readAt: string) => void;
};

export const useMessengerStore = create<MessengerState>((set) => ({
  chats: [],
  selectedChatId: null,
  messagesByChatId: {},

  setChats: (chats) => set({ chats: sortChats(chats) }),

  upsertChat: (chat) =>
    set((state) => {
      const filteredChats = state.chats.filter((currentChat) => currentChat.chatId !== chat.chatId);
      return { chats: sortChats([chat, ...filteredChats]) };
    }),

  touchChat: (chatId, occurredAt, messageId) =>
    set((state) => {
      const existingChat = state.chats.find((chat) => chat.chatId === chatId);

      if (!existingChat) {
        return state;
      }

      const touchedChat: ChatResponseDto = {
        ...existingChat,
        lastMessageId: messageId ?? existingChat.lastMessageId,
        lastMessageCreatedAt: occurredAt,
        updatedAt: occurredAt,
      };

      const nextChats = state.chats.map((chat) => (chat.chatId === chatId ? touchedChat : chat));
      return { chats: sortChats(nextChats) };
    }),

  selectChat: (chatId) => set({ selectedChatId: chatId }),

  setMessages: (chatId, messages) =>
    set((state) => ({
      messagesByChatId: {
        ...state.messagesByChatId,
        [chatId]: sortMessages(messages),
      },
    })),

  upsertMessage: (message) =>
    set((state) => {
      const currentMessages = state.messagesByChatId[message.chatId] ?? [];
      const exists = currentMessages.some((currentMessage) => currentMessage.messageId === message.messageId);
      const nextMessages = exists
        ? currentMessages.map((currentMessage) => currentMessage.messageId === message.messageId ? message : currentMessage)
        : [...currentMessages, message];

      return {
        messagesByChatId: {
          ...state.messagesByChatId,
          [message.chatId]: sortMessages(nextMessages),
        },
      };
    }),

  applyMessageDelivered: (chatId, messageId, accountId, deliveredAt) =>
    set((state) => {
      const currentMessages = state.messagesByChatId[chatId] ?? [];

      return {
        messagesByChatId: {
          ...state.messagesByChatId,
          [chatId]: currentMessages.map((message) => {
            if (message.messageId !== messageId) {
              return message;
            }

            const existingDeliveryState = message.deliveryStates.find((deliveryState) => deliveryState.accountId === accountId);

            if (!existingDeliveryState) {
              return {
                ...message,
                deliveryStates: [
                  ...message.deliveryStates,
                  {
                    accountId,
                    status: 'DELIVERED',
                    deliveredAt,
                    readAt: null,
                  },
                ],
              };
            }

            return {
              ...message,
              deliveryStates: message.deliveryStates.map((deliveryState) => {
                if (deliveryState.accountId !== accountId) {
                  return deliveryState;
                }

                return {
                  ...deliveryState,
                  status: deliveryState.status === 'READ' ? 'READ' : 'DELIVERED',
                  deliveredAt: deliveryState.deliveredAt ?? deliveredAt,
                };
              }),
            };
          }),
        },
      };
    }),

  applyMessageRead: (chatId, lastReadMessageId, accountId, readAt) =>
    set((state) => {
      const currentMessages = state.messagesByChatId[chatId] ?? [];
      const lastReadIndex = currentMessages.findIndex((message) => message.messageId === lastReadMessageId);

      if (lastReadIndex === -1) {
        return state;
      }

      return {
        messagesByChatId: {
          ...state.messagesByChatId,
          [chatId]: currentMessages.map((message, index) => {
            if (index > lastReadIndex) {
              return message;
            }

            const existingDeliveryState = message.deliveryStates.find((deliveryState) => deliveryState.accountId === accountId);

            if (!existingDeliveryState) {
              return {
                ...message,
                deliveryStates: [
                  ...message.deliveryStates,
                  {
                    accountId,
                    status: 'READ',
                    deliveredAt: readAt,
                    readAt,
                  },
                ],
              };
            }

            return {
              ...message,
              deliveryStates: message.deliveryStates.map((deliveryState) => {
                if (deliveryState.accountId !== accountId) {
                  return deliveryState;
                }

                return {
                  ...deliveryState,
                  status: 'READ',
                  deliveredAt: deliveryState.deliveredAt ?? readAt,
                  readAt,
                };
              }),
            };
          }),
        },
      };
    }),
}));
