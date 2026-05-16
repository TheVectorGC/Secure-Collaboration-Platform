import { cryptoHttpClient } from '../../../shared/api/httpClient';

export type KeyBackupStatusResponseDto = {
  exists: boolean;
  backupVersion: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type KeyBackupResponseDto = {
  accountId: string;
  backupVersion: number;
  kdfAlgorithm: string;
  kdfSaltBase64: string;
  kdfParametersJson: string;
  encryptionAlgorithm: string;
  initializationVectorBase64: string;
  authenticationTagBase64: string;
  encryptedBackupBlobBase64: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertKeyBackupRequestDto = {
  backupVersion: number;
  kdfAlgorithm: string;
  kdfSaltBase64: string;
  kdfParametersJson: string;
  encryptionAlgorithm: string;
  initializationVectorBase64: string;
  authenticationTagBase64: string;
  encryptedBackupBlobBase64: string;
};

export async function getKeyBackupStatus(): Promise<KeyBackupStatusResponseDto> {
  const response = await cryptoHttpClient.get<KeyBackupStatusResponseDto>('/api/v1/crypto/key-backup/status');
  return response.data;
}

export async function downloadKeyBackup(): Promise<KeyBackupResponseDto> {
  const response = await cryptoHttpClient.get<KeyBackupResponseDto>('/api/v1/crypto/key-backup');
  return response.data;
}

export async function uploadKeyBackup(request: UpsertKeyBackupRequestDto): Promise<KeyBackupResponseDto> {
  const response = await cryptoHttpClient.put<KeyBackupResponseDto>('/api/v1/crypto/key-backup', request);
  return response.data;
}
