import { create } from 'zustand';

export type RealtimeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

type RealtimeState = {
  status: RealtimeConnectionStatus;
  lastError: string | null;
  setStatus: (status: RealtimeConnectionStatus) => void;
  setLastError: (lastError: string | null) => void;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: 'disconnected',
  lastError: null,
  setStatus: (status) => set({ status }),
  setLastError: (lastError) => set({ lastError }),
}));
