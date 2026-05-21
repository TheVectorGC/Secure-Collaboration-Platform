import { useEffect, useState } from 'react';
import {
  readLocalReactions,
  writeLocalReactions,
} from '../../../pages/MessengerPageSupport';

export function useLocalMessageReactions(accountId: string | undefined) {
  const [localReactionsByMessageId, setLocalReactionsByMessageId] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalReactionsByMessageId(readLocalReactions(accountId));
  }, [accountId]);

  function setLocalMessageReaction(messageId: string, emoji: string) {
    setLocalReactionsByMessageId((previousValue) => {
      const nextValue = { ...previousValue };

      if (nextValue[messageId] === emoji) {
        delete nextValue[messageId];
      }
      else {
        nextValue[messageId] = emoji;
      }

      writeLocalReactions(accountId, nextValue);
      return nextValue;
    });
  }

  return {
    localReactionsByMessageId,
    setLocalMessageReaction,
  };
}
