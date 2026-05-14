import { identityHttpClient, refreshAccessToken } from '../../../shared/api/httpClient';
import type {
  AuthenticationResponseDto,
  DeviceResponseDto,
  LoginRequestDto,
  LogoutRequestDto,
  ProfileResponseDto,
  CompleteRegistrationRequestDto,
} from '../../../shared/types/api';

export async function login(request: LoginRequestDto): Promise<AuthenticationResponseDto> {
  const response = await identityHttpClient.post<AuthenticationResponseDto>('/api/v1/auth/login', request);
  return response.data;
}

export async function refreshAuthenticationToken(): Promise<AuthenticationResponseDto> {
  return refreshAccessToken();
}

export async function logout(request: LogoutRequestDto): Promise<void> {
  await identityHttpClient.post('/api/v1/auth/logout', request);
}

export async function completeRegistration(request: CompleteRegistrationRequestDto): Promise<void> {
  await identityHttpClient.post('/api/v1/auth/complete-registration', request);
}

export async function getCurrentProfile(): Promise<ProfileResponseDto> {
  const response = await identityHttpClient.get<ProfileResponseDto>('/api/v1/profiles/me');
  return response.data;
}

export async function getCurrentDevices(): Promise<DeviceResponseDto[]> {
  const response = await identityHttpClient.get<DeviceResponseDto[]>('/api/v1/devices');
  return response.data;
}
