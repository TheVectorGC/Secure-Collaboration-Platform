import axios from 'axios';
import { blockAccount, unblockAccount } from '../../account-blocks/api/accountBlocksApi';
import type { ChatResponseDto } from '../../../shared/types/api';
import type { LocalChatState } from '../lib/messengerCore';
import { clientLogger } from '../../../shared/lib/clientLogger';


function getBlockErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 400) {
      return 'Не удалось заблокировать пользователя. Проверьте выбранный чат.';
    }

    if (status === 401 || status === 403) {
      return 'Сессия не подтверждена. Войдите заново и повторите блокировку.';
    }

    if (status === 404) {
      return 'Не удалось заблокировать пользователя: профиль не найден.';
    }

    if (status === 429) {
      return 'Слишком много действий подряд. Подождите немного и повторите попытку.';
    }
  }

  return 'Не удалось заблокировать пользователя. Попробуйте ещё раз.';
}

function logBlockError(error: unknown, blockedAccountId: string | null | undefined) {
  clientLogger.error('Account block action failed.', {
    blockedAccountId,
    error,
  }, {
    dedupeKey: `account-block:${blockedAccountId ?? 'unknown'}`,
    throttleMs: 30000,
  });
}

function logUnblockError(error: unknown, blockedAccountId: string | null | undefined) {
  clientLogger.error('Account unblock action failed.', {
    blockedAccountId,
    error,
  }, {
    dedupeKey: `account-unblock:${blockedAccountId ?? 'unknown'}`,
    throttleMs: 30000,
  });
}

type DeleteSelectedChatOptions = {
  blockedAccountId?: string | null;
};

type UseDirectChatBlockControllerParams = {
  selectedChat: ChatResponseDto | null;
  currentAccountId: string | undefined;
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
    currentAccountId,
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
      if (currentAccountId && blockedAccountId === currentAccountId) {
        setErrorMessage('Нельзя заблокировать собственный профиль.');
        return;
      }

      try {
        await blockAccount({ blockedAccountId });
        upsertChat({
          ...selectedChat,
          currentAccountBlockedCompanion: true,
          companionBlockedCurrentAccount: selectedChat.companionBlockedCurrentAccount,
        });
        updateLocalChatState((previousValue) => ({
          ...previousValue,
          blockedAccountIds: Array.from(new Set([...(previousValue.blockedAccountIds ?? []), blockedAccountId])),
        }));
      }
      catch (error) {
        logBlockError(error, blockedAccountId);
        setErrorMessage(getBlockErrorMessage(error));
        return;
      }
    }

    handleDeleteSelectedChatLocally(options);
  }

  async function handleBlockSelectedDirectChat() {
    if (!selectedChat || selectedChat.type !== 'DIRECT' || !selectedDirectCompanionAccountId) {
      return;
    }

    if (currentAccountId && selectedDirectCompanionAccountId === currentAccountId) {
      setErrorMessage('Нельзя заблокировать собственный профиль.');
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
      updateLocalChatState((previousValue) => ({
        ...previousValue,
        blockedAccountIds: Array.from(new Set([...(previousValue.blockedAccountIds ?? []), selectedDirectCompanionAccountId])),
      }));
      sendCurrentTypingState(false);
    }
    catch (error) {
      logBlockError(error, selectedDirectCompanionAccountId);
      setErrorMessage(getBlockErrorMessage(error));
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
      logUnblockError(error, selectedDirectCompanionAccountId);
      setErrorMessage('Не удалось разблокировать пользователя. Попробуйте ещё раз.');
    }
  }

  return {
    handleDeleteSelectedChat,
    handleBlockSelectedDirectChat,
    handleUnblockSelectedDirectChat,
  };
}
