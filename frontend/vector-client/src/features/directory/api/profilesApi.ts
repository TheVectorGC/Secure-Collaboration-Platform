import { identityHttpClient } from '../../../shared/api/httpClient';
import type { ProfileResponseDto } from '../../../shared/types/api';

export async function searchProfiles(query: string): Promise<ProfileResponseDto[]> {
  const response = await identityHttpClient.get<ProfileResponseDto[]>('/api/v1/profiles/search', {
    params: { query },
  });

  return response.data;
}
