import { create } from 'zustand';

export type RealtimeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

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
  setStatus: (status: RealtimeConnectionStatus) => void;
  setLastError: (lastError: string | null) => void;
  setTyping: (chatId: string, accountId: string, username: string, isTyping: boolean) => void;
  clearExpiredTyping: () => void;
  sendTypingEvent: (request: SendTypingEventRequest) => void;
  setTypingSender: (sender: ((request: SendTypingEventRequest) => void) | null) => void;
};

let typingSender: ((request: SendTypingEventRequest) => void) | null = null;

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  status: 'disconnected',
  lastError: null,
  typingByChatId: {},

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

  sendTypingEvent: (request) => {
    typingSender?.(request);
  },

  setTypingSender: (sender) => {
    typingSender = sender;
    get().setLastError(get().lastError);
  },
}));
