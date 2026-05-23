import { CHAT_LOCAL_STATE_PREFIX, LOCAL_REACTIONS_PREFIX, type LocalChatState } from './messengerTypes';
export function getLocalChatStateStorageKey(accountId: string | undefined): string {
  return `${CHAT_LOCAL_STATE_PREFIX}.${accountId ?? 'anonymous'}`;
}

export function createEmptyLocalChatState(): LocalChatState {
  return {
    readAtByChatId: {},
    clearedAtByChatId: {},
    hiddenChatIds: [],
    blockedAccountIds: [],
  };
}

export function readLocalChatState(accountId: string | undefined): LocalChatState {
  const serializedValue = localStorage.getItem(getLocalChatStateStorageKey(accountId));

  if (!serializedValue) {
    return createEmptyLocalChatState();
  }

  try {
    const parsedValue = JSON.parse(serializedValue) as Partial<LocalChatState>;

    return {
      readAtByChatId: parsedValue.readAtByChatId ?? {},
      clearedAtByChatId: parsedValue.clearedAtByChatId ?? {},
      hiddenChatIds: parsedValue.hiddenChatIds ?? [],
      blockedAccountIds: parsedValue.blockedAccountIds ?? [],
    };
  }
  catch {
    return createEmptyLocalChatState();
  }
}

export function writeLocalChatState(accountId: string | undefined, localChatState: LocalChatState) {
  localStorage.setItem(getLocalChatStateStorageKey(accountId), JSON.stringify(localChatState));
}


export function getLocalReactionsStorageKey(accountId: string | undefined): string {
  return `${LOCAL_REACTIONS_PREFIX}.${accountId ?? 'anonymous'}`;
}

export function readLocalReactions(accountId: string | undefined): Record<string, string> {
  const serializedValue = localStorage.getItem(getLocalReactionsStorageKey(accountId));

  if (!serializedValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(serializedValue) as Record<string, string>;
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  }
  catch {
    return {};
  }
}

export function writeLocalReactions(accountId: string | undefined, reactionsByMessageId: Record<string, string>) {
  localStorage.setItem(getLocalReactionsStorageKey(accountId), JSON.stringify(reactionsByMessageId));
}
