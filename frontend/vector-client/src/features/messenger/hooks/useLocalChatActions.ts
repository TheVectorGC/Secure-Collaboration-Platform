import type { ChatResponseDto } from '../../../shared/types/api';
import type { LocalChatState } from '../lib/messengerCore';

type UseLocalChatActionsParams = {
  selectedChatId: string | null;
  filteredChats: ChatResponseDto[];
  selectChat: (chatId: string) => void;
  updateLocalChatState: (updater: (previousValue: LocalChatState) => LocalChatState) => void;
  setIsChatActionsMenuOpen: (isOpen: boolean) => void;
  setIsDeleteChatConfirmOpen: (isOpen: boolean) => void;
  setIsClearHistoryConfirmOpen: (isOpen: boolean) => void;
};

export function useLocalChatActions({
  selectedChatId,
  filteredChats,
  selectChat,
  updateLocalChatState,
  setIsChatActionsMenuOpen,
  setIsDeleteChatConfirmOpen,
  setIsClearHistoryConfirmOpen,
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

    setIsClearHistoryConfirmOpen(false);
    setIsChatActionsMenuOpen(false);
  }

  function restoreChatLocally(chatId: string) {
    updateLocalChatState((previousValue) => ({
      ...previousValue,
      hiddenChatIds: previousValue.hiddenChatIds.filter((hiddenChatId) => hiddenChatId !== chatId),
    }));
  }

  function handleToggleSelectedChatPinned() {
    if (!selectedChatId) {
      return;
    }

    updateLocalChatState((previousValue) => {
      const pinnedChatIdSet = new Set(previousValue.pinnedChatIds ?? []);

      if (pinnedChatIdSet.has(selectedChatId)) {
        pinnedChatIdSet.delete(selectedChatId);
      }
      else {
        pinnedChatIdSet.add(selectedChatId);
      }

      return {
        ...previousValue,
        pinnedChatIds: Array.from(pinnedChatIdSet),
      };
    });

    setIsChatActionsMenuOpen(false);
  }

  function handleDeleteSelectedChatLocally(options?: { blockedAccountId?: string | null }) {
    if (!selectedChatId) {
      return;
    }

    const chatIdToHide = selectedChatId;
    const blockedAccountId = options?.blockedAccountId ?? null;
    const deletedAt = new Date().toISOString();

    updateLocalChatState((previousValue) => ({
      ...previousValue,
      hiddenChatIds: Array.from(new Set([...previousValue.hiddenChatIds, chatIdToHide])),
      pinnedChatIds: (previousValue.pinnedChatIds ?? []).filter((pinnedChatId) => pinnedChatId !== chatIdToHide),
      clearedAtByChatId: {
        ...previousValue.clearedAtByChatId,
        [chatIdToHide]: deletedAt,
      },
      readAtByChatId: {
        ...previousValue.readAtByChatId,
        [chatIdToHide]: deletedAt,
      },
      blockedAccountIds: blockedAccountId
        ? Array.from(new Set([...(previousValue.blockedAccountIds ?? []), blockedAccountId]))
        : previousValue.blockedAccountIds ?? [],
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
    handleToggleSelectedChatPinned,
    restoreChatLocally,
  };
}
