import type { ChatResponseDto } from '../../../shared/types/api';
import type { LocalChatState } from '../lib/messengerCore';

type UseLocalChatActionsParams = {
  selectedChatId: string | null;
  filteredChats: ChatResponseDto[];
  selectChat: (chatId: string) => void;
  updateLocalChatState: (updater: (previousValue: LocalChatState) => LocalChatState) => void;
  setIsChatActionsMenuOpen: (isOpen: boolean) => void;
  setIsDeleteChatConfirmOpen: (isOpen: boolean) => void;
};

export function useLocalChatActions({
  selectedChatId,
  filteredChats,
  selectChat,
  updateLocalChatState,
  setIsChatActionsMenuOpen,
  setIsDeleteChatConfirmOpen,
}: UseLocalChatActionsParams) {
  function handleClearSelectedChatHistory() {
    if (!selectedChatId) {
      return;
    }

    const clearedAt = new Date().toISOString();

    updateLocalChatState((previousValue) => ({
      ...previousValue,
      clearedAtByChatId: {
        ...previousValue.clearedAtByChatId,
        [selectedChatId]: clearedAt,
      },
      readAtByChatId: {
        ...previousValue.readAtByChatId,
        [selectedChatId]: clearedAt,
      },
    }));

    setIsChatActionsMenuOpen(false);
  }

  function handleDeleteSelectedChatLocally() {
    if (!selectedChatId) {
      return;
    }

    const chatIdToHide = selectedChatId;

    updateLocalChatState((previousValue) => ({
      ...previousValue,
      hiddenChatIds: Array.from(new Set([...previousValue.hiddenChatIds, chatIdToHide])),
    }));

    const nextChat = filteredChats.find((chat) => chat.chatId !== chatIdToHide && chat.type === 'SELF')
      ?? filteredChats.find((chat) => chat.chatId !== chatIdToHide)
      ?? null;

    if (nextChat) {
      selectChat(nextChat.chatId);
    }

    setIsDeleteChatConfirmOpen(false);
    setIsChatActionsMenuOpen(false);
  }

  return {
    handleClearSelectedChatHistory,
    handleDeleteSelectedChatLocally,
  };
}
