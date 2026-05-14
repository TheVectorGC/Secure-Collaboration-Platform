import { identityHttpClient } from '../../../shared/api/httpClient';
import type {
  AccountRegistrationResponseDto,
  CreateAccountRegistrationRequestDto,
} from '../../../shared/types/api';

export async function createAccountRegistration(
  request: CreateAccountRegistrationRequestDto,
): Promise<AccountRegistrationResponseDto> {
  const response = await identityHttpClient.post<AccountRegistrationResponseDto>('/api/v1/admin/accounts/registrations', request);
  return response.data;
}
