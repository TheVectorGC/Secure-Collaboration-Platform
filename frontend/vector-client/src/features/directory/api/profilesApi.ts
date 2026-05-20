import { identityHttpClient } from '../../../shared/api/httpClient';
import type { ProfileResponseDto, UpdateProfileAvatarRequestDto } from '../../../shared/types/api';

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
