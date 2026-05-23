import { create } from 'zustand';

export type CryptoStatus = 'unavailable' | 'checking' | 'initializing' | 'registering' | 'locked' | 'ready' | 'error';

type CryptoState = {
  status: CryptoStatus;
  registrationId: number | null;
  databasePath: string | null;
  lastError: string | null;
  bootstrapVersion: number;
  setStatus: (status: CryptoStatus) => void;
  setReady: (registrationId: number, databasePath: string) => void;
  setUnavailable: () => void;
  setLocked: (message?: string) => void;
  setError: (message: string) => void;
  requestBootstrapRetry: () => void;
};

export const useCryptoStore = create<CryptoState>((set) => ({
  status: 'checking',
  registrationId: null,
  databasePath: null,
  lastError: null,
  bootstrapVersion: 0,

  setStatus: (status) => set({ status }),

  setReady: (registrationId, databasePath) => set({
    status: 'ready',
    registrationId,
    databasePath,
    lastError: null,
  }),

  setUnavailable: () => set({
    status: 'unavailable',
    registrationId: null,
    databasePath: null,
    lastError: null,
  }),

  setLocked: (message = 'Для доступа к защищённым сообщениям подтвердите пароль.') => set({
    status: 'locked',
    lastError: message,
  }),

  setError: (message) => set({
    status: 'error',
    lastError: message,
  }),

  requestBootstrapRetry: () => set((state) => ({
    bootstrapVersion: state.bootstrapVersion + 1,
    status: 'checking',
    lastError: null,
  })),
}));
