import { blockAccount, unblockAccount } from '../../account-blocks/api/accountBlocksApi';
import type { ChatResponseDto } from '../../../shared/types/api';
import type { LocalChatState } from '../lib/messengerCore';

type DeleteSelectedChatOptions = {
  blockedAccountId?: string | null;
};

type UseDirectChatBlockControllerParams = {
  selectedChat: ChatResponseDto | null;
  selectedDirectCompanionAccountId: string | null;
  upsertChat: (chat: ChatResponseDto) => void;
  updateLocalChatState: (updater: (previousValue: LocalChatState) => LocalChatState) => void;
  handleDeleteSelectedChatLocally: (options?: DeleteSelectedChatOptions) => void;
  sendCurrentTypingState: (isTyping: boolean) => void;
  setErrorMessage: (message: string | null) => void;
};

export function useDirectChatBlockController(params: UseDirectChatBlockControllerParams) {
  const {
    selectedChat,
    selectedDirectCompanionAccountId,
    upsertChat,
    updateLocalChatState,
    handleDeleteSelectedChatLocally,
    sendCurrentTypingState,
    setErrorMessage,
  } = params;

  async function handleDeleteSelectedChat(options?: DeleteSelectedChatOptions) {
    const blockedAccountId = options?.blockedAccountId ?? null;

    if (blockedAccountId && selectedChat?.type === 'DIRECT') {
      try {
        await blockAccount({ blockedAccountId });
        upsertChat({
          ...selectedChat,
          currentAccountBlockedCompanion: true,
          companionBlockedCurrentAccount: selectedChat.companionBlockedCurrentAccount,
        });
      }
      catch (error) {
        console.error(error);
        setErrorMessage('Не удалось заблокировать пользователя.');
        return;
      }
    }

    handleDeleteSelectedChatLocally(options);
  }

  async function handleBlockSelectedDirectChat() {
    if (!selectedChat || selectedChat.type !== 'DIRECT' || !selectedDirectCompanionAccountId) {
      return;
    }

    setErrorMessage(null);

    try {
      await blockAccount({ blockedAccountId: selectedDirectCompanionAccountId });
      upsertChat({
        ...selectedChat,
        currentAccountBlockedCompanion: true,
        companionBlockedCurrentAccount: selectedChat.companionBlockedCurrentAccount,
      });
      sendCurrentTypingState(false);
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось заблокировать пользователя.');
    }
  }

  async function handleUnblockSelectedDirectChat() {
    if (!selectedChat || selectedChat.type !== 'DIRECT' || !selectedDirectCompanionAccountId) {
      return;
    }

    setErrorMessage(null);

    try {
      await unblockAccount(selectedDirectCompanionAccountId);
      upsertChat({
        ...selectedChat,
        currentAccountBlockedCompanion: false,
        companionBlockedCurrentAccount: selectedChat.companionBlockedCurrentAccount,
      });
      updateLocalChatState((previousValue) => ({
        ...previousValue,
        blockedAccountIds: (previousValue.blockedAccountIds ?? []).filter((accountId) => accountId !== selectedDirectCompanionAccountId),
      }));
    }
    catch (error) {
      console.error(error);
      setErrorMessage('Не удалось разблокировать пользователя.');
    }
  }

  return {
    handleDeleteSelectedChat,
    handleBlockSelectedDirectChat,
    handleUnblockSelectedDirectChat,
  };
}
