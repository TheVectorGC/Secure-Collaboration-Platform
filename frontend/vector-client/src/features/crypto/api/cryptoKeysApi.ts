import { AxiosError } from 'axios';
import { cryptoHttpClient } from '../../../shared/api/httpClient';
import type { LocalPublicSignalKeyBundle, PreKeyBundleResponseDto } from '../../../shared/types/vectorCrypto';

export type PreKeyStatusResponseDto = {
  deviceId: string;
  identityKeyRegistered: boolean;
  activeSignedPreKeyRegistered: boolean;
  availableOneTimePreKeyCount: number;
  activeKyberPreKeyRegistered: boolean;
  lowPreKeyThresholdReached: boolean;
};

type RegisterIdentityKeyRequestDto = {
  registrationId: number;
  publicKey: string;
};

type UploadSignedPreKeyRequestDto = {
  keyId: number;
  publicKey: string;
  signature: string;
  expiresAt: string | null;
};

type UploadKyberPreKeyRequestDto = {
  keyId: number;
  publicKey: string;
  signature: string;
  expiresAt: string | null;
};

type UploadOneTimePreKeysRequestDto = {
  preKeys: Array<{
    keyId: number;
    publicKey: string;
  }>;
  expiresAt: string | null;
};

function isNotFound(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 404;
}

function isActiveSignedPreKeyRegistered(status: PreKeyStatusResponseDto | null): boolean {
  return status?.activeSignedPreKeyRegistered ?? false;
}

function isOneTimePreKeyRefillRequired(status: PreKeyStatusResponseDto | null): boolean {
  return !status || status.lowPreKeyThresholdReached || status.availableOneTimePreKeyCount === 0;
}

function hasEnoughRegisteredKeys(status: PreKeyStatusResponseDto): boolean {
  return status.identityKeyRegistered
    && isActiveSignedPreKeyRegistered(status)
    && status.activeKyberPreKeyRegistered
    && !isOneTimePreKeyRefillRequired(status);
}

export async function getDevicePreKeyStatus(deviceId: string): Promise<PreKeyStatusResponseDto> {
  const response = await cryptoHttpClient.get<PreKeyStatusResponseDto>(
    `/api/v1/crypto/devices/${deviceId}/prekey-status`,
  );

  return response.data;
}

export async function registerIdentityKey(deviceId: string, request: RegisterIdentityKeyRequestDto): Promise<void> {
  await cryptoHttpClient.post(`/api/v1/crypto/devices/${deviceId}/identity-key`, request);
}

export async function uploadSignedPreKey(deviceId: string, request: UploadSignedPreKeyRequestDto): Promise<void> {
  await cryptoHttpClient.put(`/api/v1/crypto/devices/${deviceId}/signed-prekey`, request);
}

export async function uploadKyberPreKey(deviceId: string, request: UploadKyberPreKeyRequestDto): Promise<void> {
  await cryptoHttpClient.put(`/api/v1/crypto/devices/${deviceId}/kyber-prekey`, request);
}

export async function uploadOneTimePreKeys(deviceId: string, request: UploadOneTimePreKeysRequestDto): Promise<void> {
  await cryptoHttpClient.post(`/api/v1/crypto/devices/${deviceId}/one-time-prekeys`, request);
}

export async function getPreKeyBundle(deviceId: string): Promise<PreKeyBundleResponseDto> {
  const response = await cryptoHttpClient.get<PreKeyBundleResponseDto>(`/api/v1/crypto/devices/${deviceId}/prekey-bundle`);
  return response.data;
}

async function uploadMissingDeviceKeys(
  deviceId: string,
  status: PreKeyStatusResponseDto | null,
  signalKeyBundle: LocalPublicSignalKeyBundle,
): Promise<void> {
  if (!status?.identityKeyRegistered) {
    await registerIdentityKey(deviceId, {
      registrationId: signalKeyBundle.registrationId,
      publicKey: signalKeyBundle.identityKey.publicKey,
    });
  }

  if (!isActiveSignedPreKeyRegistered(status)) {
    await uploadSignedPreKey(deviceId, {
      keyId: signalKeyBundle.signedPreKey.keyId,
      publicKey: signalKeyBundle.signedPreKey.publicKey,
      signature: signalKeyBundle.signedPreKey.signature,
      expiresAt: signalKeyBundle.signedPreKey.expiresAt,
    });
  }

  if (!status?.activeKyberPreKeyRegistered) {
    await uploadKyberPreKey(deviceId, {
      keyId: signalKeyBundle.kyberPreKey.keyId,
      publicKey: signalKeyBundle.kyberPreKey.publicKey,
      signature: signalKeyBundle.kyberPreKey.signature,
      expiresAt: signalKeyBundle.kyberPreKey.expiresAt,
    });
  }

  if (isOneTimePreKeyRefillRequired(status) && signalKeyBundle.oneTimePreKeys.length > 0) {
    await uploadOneTimePreKeys(deviceId, {
      preKeys: signalKeyBundle.oneTimePreKeys,
      expiresAt: null,
    });
  }
}

export async function ensureCryptoDeviceKeysRegistered(
  deviceId: string,
  signalKeyBundle: LocalPublicSignalKeyBundle,
): Promise<PreKeyStatusResponseDto> {
  let currentStatus: PreKeyStatusResponseDto | null = null;

  try {
    currentStatus = await getDevicePreKeyStatus(deviceId);

    if (hasEnoughRegisteredKeys(currentStatus)) {
      return currentStatus;
    }
  }
  catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  await uploadMissingDeviceKeys(deviceId, currentStatus, signalKeyBundle);

  const finalStatus = await getDevicePreKeyStatus(deviceId);

  if (!finalStatus.identityKeyRegistered || !isActiveSignedPreKeyRegistered(finalStatus) || !finalStatus.activeKyberPreKeyRegistered) {
    throw new Error('Crypto key registration finished, but crypto-service still reports missing identity, active signed prekey or active Kyber prekey.');
  }

  return finalStatus;
}
