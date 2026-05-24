import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { serviceUrls } from '../config/serviceUrls';
import { useAuthStore } from '../../features/auth/model/authStore';
import type { AuthenticationResponseDto } from '../types/api';

export const identityHttpClient = axios.create({
  baseURL: serviceUrls.identityBaseUrl,
});

export const messagingHttpClient = axios.create({
  baseURL: serviceUrls.messagingBaseUrl,
});

export const cryptoHttpClient = axios.create({
  baseURL: serviceUrls.cryptoBaseUrl,
});

export const mediaHttpClient = axios.create({
  baseURL: serviceUrls.mediaBaseUrl,
});

export const documentHttpClient = axios.create({
  baseURL: serviceUrls.documentBaseUrl,
});

const refreshHttpClient = axios.create({
  baseURL: serviceUrls.identityBaseUrl,
});

let refreshRequestPromise: Promise<AuthenticationResponseDto> | null = null;

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

function isRefreshEndpoint(url?: string): boolean {
  return Boolean(url?.includes('/api/v1/auth/refresh'));
}

async function refreshAuthentication(): Promise<AuthenticationResponseDto> {
  const refreshToken = useAuthStore.getState().refreshToken;

  if (!refreshToken) {
    throw new Error('Refresh token is missing.');
  }

  if (!refreshRequestPromise) {
    const nextRefreshRequestPromise = refreshHttpClient
      .post<AuthenticationResponseDto>('/api/v1/auth/refresh', { refreshToken })
      .then((response) => {
        useAuthStore.getState().setAuthentication(response.data);
        return response.data;
      })
      .finally(() => {
        refreshRequestPromise = null;
      });

    refreshRequestPromise = nextRefreshRequestPromise;
  }

  const activeRefreshRequestPromise = refreshRequestPromise;

  if (!activeRefreshRequestPromise) {
    throw new Error('Не удалось обновить сессию.');
  }

  return activeRefreshRequestPromise;
}

function attachAuthorizationHeader(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const accessToken = useAuthStore.getState().accessToken;

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
}

async function handleUnauthorizedError(error: AxiosError) {
  const responseStatus = error.response?.status;
  const originalRequest = error.config as RetriableRequestConfig | undefined;

  if (responseStatus !== 401 || !originalRequest || originalRequest._retry || isRefreshEndpoint(originalRequest.url)) {
    throw error;
  }

  originalRequest._retry = true;

  try {
    const authenticationResponse = await refreshAuthentication();
    originalRequest.headers.Authorization = `Bearer ${authenticationResponse.accessToken}`;
    return axios(originalRequest);
  }
  catch (refreshError) {
    useAuthStore.getState().clearAuthentication();
    window.location.href = '/login';
    throw refreshError;
  }
}

for (const httpClient of [identityHttpClient, messagingHttpClient, cryptoHttpClient, mediaHttpClient, documentHttpClient]) {
  httpClient.interceptors.request.use(attachAuthorizationHeader);
  httpClient.interceptors.response.use((response) => response, handleUnauthorizedError);
}

export async function refreshAccessToken(): Promise<AuthenticationResponseDto> {
  return refreshAuthentication();
}
