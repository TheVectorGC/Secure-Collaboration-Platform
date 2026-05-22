import { cryptoHttpClient } from '../../../shared/api/httpClient';

export type AccountBackupProfileResponseDto = {
  accountId: string;
  backupPublicKeyBase64: string;
  encryptedBackupPrivateKeyBase64: string;
  kdfAlgorithm: string;
  kdfSaltBase64: string;
  kdfParametersJson: string;
  privateKeyEncryptionAlgorithm: string;
  privateKeyInitializationVectorBase64: string;
  privateKeyAuthenticationTagBase64: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountBackupPublicKeyResponseDto = {
  accountId: string;
  backupPublicKeyBase64: string;
};

export type UpsertAccountBackupProfileRequestDto = {
  backupPublicKeyBase64: string;
  encryptedBackupPrivateKeyBase64: string;
  kdfAlgorithm: string;
  kdfSaltBase64: string;
  kdfParametersJson: string;
  privateKeyEncryptionAlgorithm: string;
  privateKeyInitializationVectorBase64: string;
  privateKeyAuthenticationTagBase64: string;
};

export async function getCurrentAccountBackupProfile(): Promise<AccountBackupProfileResponseDto> {
  const response = await cryptoHttpClient.get<AccountBackupProfileResponseDto>('/api/v1/crypto/account-backup-profiles/me');
  return response.data;
}

export async function upsertCurrentAccountBackupProfile(request: UpsertAccountBackupProfileRequestDto): Promise<AccountBackupProfileResponseDto> {
  const response = await cryptoHttpClient.put<AccountBackupProfileResponseDto>('/api/v1/crypto/account-backup-profiles/me', request);
  return response.data;
}

export async function getAccountBackupPublicKey(accountId: string): Promise<AccountBackupPublicKeyResponseDto> {
  const response = await cryptoHttpClient.get<AccountBackupPublicKeyResponseDto>(`/api/v1/crypto/account-backup-profiles/accounts/${accountId}/public-key`);
  return response.data;
}
