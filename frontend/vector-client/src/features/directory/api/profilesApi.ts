import { identityHttpClient } from '../../../shared/api/httpClient';
import type { ProfileResponseDto, UpdateProfileAvatarRequestDto } from '../../../shared/types/api';

export async function getProfilesByAccountIds(accountIds: string[]): Promise<ProfileResponseDto[]> {
  if (accountIds.length === 0) {
    return [];
  }

  const queryParameters = new URLSearchParams();
  accountIds.forEach((accountId) => queryParameters.append('accountIds', accountId));

  const response = await identityHttpClient.get<ProfileResponseDto[]>(`/api/v1/profiles/accounts?${queryParameters.toString()}`);
  return response.data;
}

export async function searchProfiles(query: string): Promise<ProfileResponseDto[]> {
  const response = await identityHttpClient.get<ProfileResponseDto[]>('/api/v1/profiles/search', {
    params: { query },
  });

  return response.data;
}

export async function updateCurrentProfileAvatar(request: UpdateProfileAvatarRequestDto): Promise<ProfileResponseDto> {
  const response = await identityHttpClient.put<ProfileResponseDto>('/api/v1/profiles/me/avatar', request);
  return response.data;
}
