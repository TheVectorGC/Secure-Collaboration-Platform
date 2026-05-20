import { create } from 'zustand';
import type { AccountPresencePayload } from '../../../shared/types/api';

export type RealtimeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type AccountPresenceState = {
  accountId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
};

type TypingState = {
  accountId: string;
  username: string;
  expiresAt: number;
};

type SendTypingEventRequest = {
  chatId: string;
  recipientAccountIds: string[];
  isTyping: boolean;
};

type RealtimeState = {
  status: RealtimeConnectionStatus;
  lastError: string | null;
  typingByChatId: Record<string, TypingState[]>;
  presenceByAccountId: Record<string, AccountPresenceState>;
  setStatus: (status: RealtimeConnectionStatus) => void;
  setLastError: (lastError: string | null) => void;
  setTyping: (chatId: string, accountId: string, username: string, isTyping: boolean) => void;
  clearExpiredTyping: () => void;
  setPresence: (presence: AccountPresencePayload) => void;
  applyPresenceSnapshot: (accounts: AccountPresencePayload[]) => void;
  sendTypingEvent: (request: SendTypingEventRequest) => void;
  setTypingSender: (sender: ((request: SendTypingEventRequest) => void) | null) => void;
};

const PRESENCE_STORAGE_KEY = 'vector.presenceByAccountId';

let typingSender: ((request: SendTypingEventRequest) => void) | null = null;

function readPresenceByAccountId(): Record<string, AccountPresenceState> {
  const serializedValue = localStorage.getItem(PRESENCE_STORAGE_KEY);

  if (!serializedValue) {
    return {};
  }

  try {
    return JSON.parse(serializedValue) as Record<string, AccountPresenceState>;
  }
  catch {
    return {};
  }
}

function persistPresenceByAccountId(presenceByAccountId: Record<string, AccountPresenceState>) {
  localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(presenceByAccountId));
}

function mapPresencePayload(payload: AccountPresencePayload): AccountPresenceState {
  return {
    accountId: payload.accountId,
    isOnline: payload.online,
    lastSeenAt: payload.online ? null : payload.lastSeenAt,
  };
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  status: 'disconnected',
  lastError: null,
  typingByChatId: {},
  presenceByAccountId: readPresenceByAccountId(),

  setStatus: (status) => set({ status }),
  setLastError: (lastError) => set({ lastError }),

  setTyping: (chatId, accountId, username, isTyping) => set((state) => {
    const currentTypingStates = state.typingByChatId[chatId] ?? [];
    const remainingTypingStates = currentTypingStates.filter((typingState) => typingState.accountId !== accountId);

    if (!isTyping) {
      return {
        typingByChatId: {
          ...state.typingByChatId,
          [chatId]: remainingTypingStates,
        },
      };
    }

    return {
      typingByChatId: {
        ...state.typingByChatId,
        [chatId]: [
          ...remainingTypingStates,
          {
            accountId,
            username,
            expiresAt: Date.now() + 4500,
          },
        ],
      },
    };
  }),

  clearExpiredTyping: () => set((state) => {
    const now = Date.now();
    const nextTypingByChatId: Record<string, TypingState[]> = {};

    Object.entries(state.typingByChatId).forEach(([chatId, typingStates]) => {
      const activeTypingStates = typingStates.filter((typingState) => typingState.expiresAt > now);

      if (activeTypingStates.length > 0) {
        nextTypingByChatId[chatId] = activeTypingStates;
      }
    });

    return { typingByChatId: nextTypingByChatId };
  }),

  setPresence: (presence) => set((state) => {
    const nextPresenceByAccountId = {
      ...state.presenceByAccountId,
      [presence.accountId]: mapPresencePayload(presence),
    };

    persistPresenceByAccountId(nextPresenceByAccountId);
    return { presenceByAccountId: nextPresenceByAccountId };
  }),

  applyPresenceSnapshot: (accounts) => set((state) => {
    const nextPresenceByAccountId = { ...state.presenceByAccountId };

    accounts.forEach((accountPresence) => {
      nextPresenceByAccountId[accountPresence.accountId] = mapPresencePayload(accountPresence);
    });

    persistPresenceByAccountId(nextPresenceByAccountId);
    return { presenceByAccountId: nextPresenceByAccountId };
  }),

  sendTypingEvent: (request) => {
    typingSender?.(request);
  },

  setTypingSender: (sender) => {
    typingSender = sender;
    get().setLastError(get().lastError);
  },
}));
