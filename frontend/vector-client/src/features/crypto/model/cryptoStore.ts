import { create } from 'zustand';

export type CryptoStatus = 'unavailable' | 'checking' | 'initializing' | 'registering' | 'ready' | 'error';

type CryptoState = {
  status: CryptoStatus;
  registrationId: number | null;
  databasePath: string | null;
  lastError: string | null;
  setStatus: (status: CryptoStatus) => void;
  setReady: (registrationId: number, databasePath: string) => void;
  setUnavailable: () => void;
  setError: (message: string) => void;
};

export const useCryptoStore = create<CryptoState>((set) => ({
  status: 'checking',
  registrationId: null,
  databasePath: null,
  lastError: null,

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

  setError: (message) => set({
    status: 'error',
    lastError: message,
  }),
}));
