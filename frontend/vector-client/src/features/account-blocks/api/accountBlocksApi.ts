import { identityHttpClient } from '../../../shared/api/httpClient';
import type { AccountBlockResponseDto, BlockAccountRequestDto } from '../../../shared/types/api';

export async function blockAccount(request: BlockAccountRequestDto): Promise<AccountBlockResponseDto> {
  const response = await identityHttpClient.post<AccountBlockResponseDto>('/api/v1/account-blocks', request);
  return response.data;
}

export async function unblockAccount(blockedAccountId: string): Promise<void> {
  await identityHttpClient.delete(`/api/v1/account-blocks/${blockedAccountId}`);
}
