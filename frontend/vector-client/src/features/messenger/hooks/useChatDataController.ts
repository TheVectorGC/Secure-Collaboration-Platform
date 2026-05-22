import { useEffect, type MutableRefObject } from 'react';
import { createSelfChat, getChat, getChats } from '../../chats/api/chatsApi';
import { getChatMessages, markMessageDelivered } from '../../messages/api/messagesApi';
import type { ChatResponseDto, MessageResponseDto } from '../../../shared/types/api';
import type { LocalChatState } from '../lib/messengerCore';


type UpdateLocalChatState = (updater: (previousValue: LocalChatState) => LocalChatState) => void;

type UseChatDataControllerParams = {
  selectedChatId: string | null;
  selectedChat: ChatResponseDto | null;
  chats: ChatResponseDto[];
  hiddenChatIdSet: Set<string>;
  messagesByChatId: Record<string, MessageResponseDto[]>;
  localChatState: LocalChatState;
  currentAccountId: string | undefined;
  visibleSelectedMessages: MessageResponseDto[];
  isSelectedChatWritable: boolean;
  setChats: (chats: ChatResponseDto[]) => void;
  upsertChat: (chat: ChatResponseDto) => void;
  selectChat: (chatId: string) => void;
  setMessages: (chatId: string, messages: MessageResponseDto[]) => void;
  updateLocalChatState: UpdateLocalChatState;
  setErrorMessage: (message: string | null) => void;
  setReadDetailsMessageId: (messageId: string | null) => void;
  deliveredMarkersRef: MutableRefObject<Set<string>>;
};

export function useChatDataController(params: UseChatDataControllerParams) {
  const {
    selectedChatId,
    chats,
    hiddenChatIdSet,
    messagesByChatId,
    localChatState,
    currentAccountId,
    visibleSelectedMessages,
    isSelectedChatWritable,
    setChats,
    upsertChat,
    selectChat,
    setMessages,
    updateLocalChatState,
    setErrorMessage,
    setReadDetailsMessageId,
    deliveredMarkersRef,
  } = params;

  async function refreshSelectedChat(options?: { silent?: boolean }) {
    if (!selectedChatId) {
      return null;
    }

    try {
      const refreshedChat = await getChat(selectedChatId);
      upsertChat(refreshedChat);
      return refreshedChat;
    }
    catch (error) {
      if (!options?.silent) {
        console.error(error);
      }
      return null;
    }
  }

  useEffect(() => {
    async function loadChats() {
      try {
        const loadedChats = await getChats();
        let nextChats = loadedChats;

        if (!loadedChats.some((chat) => chat.type === 'SELF')) {
          const selfChat = await createSelfChat();
          nextChats = [selfChat, ...loadedChats];
        }

        setChats(nextChats);

        if (nextChats.length > 0) {
          const activeChatStillExists = selectedChatId && nextChats.some((chat) => chat.chatId === selectedChatId);

          if (!activeChatStillExists) {
            const selfChat = nextChats.find((chat) => chat.type === 'SELF');
            selectChat(selfChat?.chatId ?? nextChats[0].chatId);
          }
        }
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось загрузить чаты.');
      }
    }

    void loadChats();
  }, [selectChat, selectedChatId, setChats]);

  useEffect(() => {
    async function loadMessages() {
      if (!selectedChatId) {
        return;
      }

      try {
        const loadedMessages = await getChatMessages(selectedChatId);
        setMessages(selectedChatId, loadedMessages);
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось загрузить сообщения.');
      }
    }

    void loadMessages();
  }, [selectedChatId, setMessages]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMissingChatMessages() {
      const chatsWithoutMessages = chats.filter((chat) => (
        !hiddenChatIdSet.has(chat.chatId)
        && !messagesByChatId[chat.chatId]
      ));

      await Promise.all(chatsWithoutMessages.map(async (chat) => {
        try {
          const loadedMessagesForChat = await getChatMessages(chat.chatId);

          if (!isCancelled) {
            setMessages(chat.chatId, loadedMessagesForChat);
          }
        }
        catch (error) {
          console.warn('Failed to load chat messages for sidebar preview.', error);
        }
      }));
    }

    void loadMissingChatMessages();

    return () => {
      isCancelled = true;
    };
  }, [chats, hiddenChatIdSet, messagesByChatId, setMessages]);

  useEffect(() => {
    if (!currentAccountId || localChatState.hiddenChatIds.length === 0) {
      return;
    }

    const hiddenChatIdsToRestore = localChatState.hiddenChatIds.filter((hiddenChatId) => {
      const chatMessages = messagesByChatId[hiddenChatId] ?? [];
      const clearedAt = localChatState.clearedAtByChatId[hiddenChatId];
      const clearedAtTime = clearedAt ? new Date(clearedAt).getTime() : 0;

      return chatMessages.some((message) => (
        message.senderAccountId !== currentAccountId
        && new Date(message.createdAt).getTime() > clearedAtTime
      ));
    });

    if (hiddenChatIdsToRestore.length === 0) {
      return;
    }

    const hiddenChatIdRestoreSet = new Set(hiddenChatIdsToRestore);

    updateLocalChatState((previousValue) => ({
      ...previousValue,
      hiddenChatIds: previousValue.hiddenChatIds.filter((hiddenChatId) => !hiddenChatIdRestoreSet.has(hiddenChatId)),
    }));
  }, [localChatState.clearedAtByChatId, localChatState.hiddenChatIds, messagesByChatId, currentAccountId]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    let isCancelled = false;

    const refreshChat = async () => {
      if (isCancelled) {
        return;
      }

      await refreshSelectedChat({ silent: true });
    };

    void refreshChat();
    const intervalId = window.setInterval(refreshChat, 2500);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedChatId]);

  useEffect(() => {
    setReadDetailsMessageId(null);
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId || !currentAccountId || visibleSelectedMessages.length === 0 || !isSelectedChatWritable) {
      return;
    }

    const incomingMessages = visibleSelectedMessages.filter((message) => (
      message.senderAccountId !== currentAccountId
      && message.messageType !== 'SYSTEM'
    ));

    incomingMessages.forEach((message) => {
      const deliveredMarker = `${selectedChatId}:${message.messageId}:delivered`;

      if (deliveredMarkersRef.current.has(deliveredMarker)) {
        return;
      }

      deliveredMarkersRef.current.add(deliveredMarker);
      markMessageDelivered(selectedChatId, message.messageId).catch((error) => {
        console.error(error);
      });
    });

  }, [isSelectedChatWritable, currentAccountId, selectedChatId, visibleSelectedMessages]);

  return {
    refreshSelectedChat,
  };
}
