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
  applyMessageEdited: (message: MessageResponseDto) => void;
  applyMessageDelivered: (chatId: string, messageId: string, accountId: string, deliveredAt: string) => void;
  applyMessageRead: (chatId: string, lastReadMessageId: string, readMessageIds: string[], accountId: string, readAt: string) => void;
  applyMessageReaction: (chatId: string, messageId: string, accountId: string, emoji: string | null, updatedAt: string) => void;
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


  applyMessageEdited: (message) =>
    set((state) => {
      const currentMessages = state.messagesByChatId[message.chatId] ?? [];

      return {
        messagesByChatId: {
          ...state.messagesByChatId,
          [message.chatId]: currentMessages.map((currentMessage) => {
            if (currentMessage.messageId !== message.messageId) {
              return currentMessage;
            }

            return {
              ...currentMessage,
              senderDeviceId: message.senderDeviceId,
              encryptionType: message.encryptionType,
              encryptedPayload: message.encryptedPayload,
              contentAlgorithm: message.contentAlgorithm,
              contentInitializationVectorBase64: message.contentInitializationVectorBase64,
              contentAuthenticationTagBase64: message.contentAuthenticationTagBase64,
              groupKeyEpoch: message.groupKeyEpoch,
              devicePayloads: message.devicePayloads,
              accountKeyEnvelopes: message.accountKeyEnvelopes,
              groupEpochKeyEnvelope: message.groupEpochKeyEnvelope,
              editedAt: message.editedAt ?? null,
              editVersion: message.editVersion ?? ((currentMessage.editVersion ?? 0) + 1),
            };
          }),
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

  applyMessageRead: (chatId, lastReadMessageId, readMessageIds, accountId, readAt) =>
    set((state) => {
      const currentMessages = state.messagesByChatId[chatId] ?? [];
      const explicitReadMessageIds = new Set(readMessageIds);
      const lastReadIndex = currentMessages.findIndex((message) => message.messageId === lastReadMessageId);

      if (explicitReadMessageIds.size === 0 && lastReadIndex === -1) {
        return state;
      }

      return {
        messagesByChatId: {
          ...state.messagesByChatId,
          [chatId]: currentMessages.map((message, index) => {
            const shouldApplyReadState = explicitReadMessageIds.size > 0
              ? explicitReadMessageIds.has(message.messageId)
              : index <= lastReadIndex;

            if (!shouldApplyReadState || message.senderAccountId === accountId) {
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

  applyMessageReaction: (chatId, messageId, accountId, emoji, updatedAt) =>
    set((state) => {
      const currentMessages = state.messagesByChatId[chatId] ?? [];

      return {
        messagesByChatId: {
          ...state.messagesByChatId,
          [chatId]: currentMessages.map((message) => {
            if (message.messageId !== messageId) {
              return message;
            }

            const reactionsWithoutAccount = (message.reactions ?? []).filter((reaction) => reaction.accountId !== accountId);

            if (!emoji) {
              return {
                ...message,
                reactions: reactionsWithoutAccount,
              };
            }

            return {
              ...message,
              reactions: [
                ...reactionsWithoutAccount,
                {
                  messageId,
                  accountId,
                  emoji,
                  createdAt: updatedAt,
                  updatedAt,
                },
              ],
            };
          }),
        },
      };
    }),
}));
