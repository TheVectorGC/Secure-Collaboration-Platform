import { useEffect, useState } from 'react';
import {
  LocalChatState,
  readLocalChatState,
  writeLocalChatState,
} from '../../../pages/MessengerPageSupport';

export function usePersistentLocalChatState(accountId: string | undefined) {
  const [localChatState, setLocalChatState] = useState<LocalChatState>(() => readLocalChatState(accountId));

  useEffect(() => {
    setLocalChatState(readLocalChatState(accountId));
  }, [accountId]);

  function updateLocalChatState(updater: (previousValue: LocalChatState) => LocalChatState) {
    setLocalChatState((previousValue) => {
      const nextValue = updater(previousValue);
      writeLocalChatState(accountId, nextValue);
      return nextValue;
    });
  }

  return {
    localChatState,
    updateLocalChatState,
  };
}
