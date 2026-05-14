import { create } from 'zustand';
import type { AuthenticationResponseDto, ProfileResponseDto } from '../../../shared/types/api';

const ACCESS_TOKEN_STORAGE_KEY = 'vector.accessToken';
const REFRESH_TOKEN_STORAGE_KEY = 'vector.refreshToken';
const DEVICE_ID_STORAGE_KEY = 'vector.deviceId';
const SESSION_ID_STORAGE_KEY = 'vector.sessionId';
const ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY = 'vector.accessTokenExpiresAt';
const PROFILE_STORAGE_KEY = 'vector.profile';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string | null;
  sessionId: string | null;
  accessTokenExpiresAt: string | null;
  profile: ProfileResponseDto | null;
  setAuthentication: (authenticationResponse: AuthenticationResponseDto, fallbackDeviceId?: string | null) => void;
  setDeviceId: (deviceId: string) => void;
  setProfile: (profile: ProfileResponseDto) => void;
  clearAuthentication: () => void;
};

function readProfileFromStorage(): ProfileResponseDto | null {
  const serializedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);

  if (!serializedProfile) {
    return null;
  }

  try {
    return JSON.parse(serializedProfile) as ProfileResponseDto;
  }
  catch {
    return null;
  }
}

function clearAuthenticationStorage() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(DEVICE_ID_STORAGE_KEY);
  localStorage.removeItem(SESSION_ID_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY);
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY),
  refreshToken: localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
  deviceId: localStorage.getItem(DEVICE_ID_STORAGE_KEY),
  sessionId: localStorage.getItem(SESSION_ID_STORAGE_KEY),
  accessTokenExpiresAt: localStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY),
  profile: readProfileFromStorage(),

  setAuthentication: (authenticationResponse, fallbackDeviceId) => {
    const resolvedDeviceId = fallbackDeviceId ?? localStorage.getItem(DEVICE_ID_STORAGE_KEY);

    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, authenticationResponse.accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, authenticationResponse.refreshToken);
    localStorage.setItem(SESSION_ID_STORAGE_KEY, authenticationResponse.sessionId);
    localStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY, authenticationResponse.accessTokenExpiresAt);

    if (resolvedDeviceId) {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, resolvedDeviceId);
    }

    set({
      accessToken: authenticationResponse.accessToken,
      refreshToken: authenticationResponse.refreshToken,
      sessionId: authenticationResponse.sessionId,
      accessTokenExpiresAt: authenticationResponse.accessTokenExpiresAt,
      deviceId: resolvedDeviceId,
    });
  },

  setDeviceId: (deviceId) => {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    set({ deviceId });
  },

  setProfile: (profile) => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    set({ profile });
  },

  clearAuthentication: () => {
    clearAuthenticationStorage();

    set({
      accessToken: null,
      refreshToken: null,
      deviceId: null,
      sessionId: null,
      accessTokenExpiresAt: null,
      profile: null,
    });
  },
}));
