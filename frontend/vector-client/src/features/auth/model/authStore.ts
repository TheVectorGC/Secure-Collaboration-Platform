import { create } from 'zustand';
import type { AuthenticationResponseDto, ProfileResponseDto } from '../../../shared/types/api';

const ACCESS_TOKEN_STORAGE_KEY = 'vector.accessToken';
const REFRESH_TOKEN_STORAGE_KEY = 'vector.refreshToken';
const DEVICE_ID_STORAGE_KEY = 'vector.deviceId';
const SESSION_ID_STORAGE_KEY = 'vector.sessionId';
const ACCESS_TOKEN_EXPIRES_AT_STORAGE_KEY = 'vector.accessTokenExpiresAt';
const PROFILE_STORAGE_KEY = 'vector.profile';
const REMEMBERED_DEVICE_ID_STORAGE_PREFIX = 'vector.rememberedDeviceId.';

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


function normalizeAuthIdentifier(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

function getRememberedDeviceStorageKey(identifier: string): string {
  return `${REMEMBERED_DEVICE_ID_STORAGE_PREFIX}${identifier}`;
}

export function getRememberedDeviceIdForLogin(login: string | null | undefined): string | null {
  const normalizedLogin = normalizeAuthIdentifier(login);

  if (!normalizedLogin) {
    return null;
  }

  return localStorage.getItem(getRememberedDeviceStorageKey(normalizedLogin));
}

export function rememberDeviceIdForLogin(login: string | null | undefined, deviceId: string | null | undefined) {
  const normalizedLogin = normalizeAuthIdentifier(login);

  if (!normalizedLogin || !deviceId) {
    return;
  }

  localStorage.setItem(getRememberedDeviceStorageKey(normalizedLogin), deviceId);
}

export function rememberDeviceIdForProfile(profile: ProfileResponseDto | null | undefined, deviceId: string | null | undefined) {
  if (!profile || !deviceId) {
    return;
  }

  rememberDeviceIdForLogin(profile.accountId, deviceId);
  rememberDeviceIdForLogin(profile.username, deviceId);
  rememberDeviceIdForLogin(profile.email, deviceId);
}

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
  rememberDeviceIdForProfile(readProfileFromStorage(), localStorage.getItem(DEVICE_ID_STORAGE_KEY));

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
    const resolvedDeviceId = authenticationResponse.deviceId ?? fallbackDeviceId ?? localStorage.getItem(DEVICE_ID_STORAGE_KEY);

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
    rememberDeviceIdForProfile(profile, localStorage.getItem(DEVICE_ID_STORAGE_KEY));
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
