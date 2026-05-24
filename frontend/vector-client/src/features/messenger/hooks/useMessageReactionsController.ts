import { removeMessageReaction, setMessageReaction } from '../../messages/api/messageReactionsApi';
import { clientLogger } from '../../../shared/lib/clientLogger';

type UseMessageReactionsControllerParams = {
  currentAccountId: string | undefined;
  applyMessageReaction: (chatId: string, messageId: string, accountId: string, emoji: string | null, updatedAt: string) => void;
  closeMessageContextMenu: () => void;
  setErrorMessage: (message: string | null) => void;
};

export function useMessageReactionsController({
  currentAccountId,
  applyMessageReaction,
  closeMessageContextMenu,
  setErrorMessage,
}: UseMessageReactionsControllerParams) {
  async function setMessageReactionForChat(chatId: string, messageId: string, currentEmoji: string | null, nextEmoji: string) {
    if (!currentAccountId) {
      return;
    }

    closeMessageContextMenu();

    try {
      if (currentEmoji === nextEmoji) {
        await removeMessageReaction(chatId, messageId);
        applyMessageReaction(chatId, messageId, currentAccountId, null, new Date().toISOString());
        return;
      }

      const reaction = await setMessageReaction(chatId, messageId, { emoji: nextEmoji });
      applyMessageReaction(chatId, messageId, reaction.accountId, reaction.emoji, reaction.updatedAt);
    }
    catch (error) {
      clientLogger.error('Message reaction update failed.', {
        chatId,
        messageId,
        currentAccountId,
        nextEmoji,
        error,
      }, {
        dedupeKey: `message-reaction:${chatId}:${messageId}:${currentAccountId ?? 'unknown'}`,
        throttleMs: 15000,
      });
      setErrorMessage('Не удалось обновить реакцию. Попробуйте ещё раз.');
    }
  }

  return {
    setMessageReactionForChat,
  };
}
