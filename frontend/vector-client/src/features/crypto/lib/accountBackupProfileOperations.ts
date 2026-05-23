import {
  getCurrentAccountBackupProfile,
  upsertCurrentAccountBackupProfile,
  type AccountBackupProfileResponseDto,
} from '../api/accountBackupProfileApi';

function isNotFoundError(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

export async function prepareAccountBackupUnlockKey(accountId: string, accountPassword: string): Promise<void> {
  if (!window.vectorCrypto) {
    throw new Error('Local cryptography is not available.');
  }

  try {
    const existingProfile = await getCurrentAccountBackupProfile();
    await window.vectorCrypto.setAccountBackupPassword({
      accountId,
      password: accountPassword,
      kdfSaltBase64: existingProfile.kdfSaltBase64,
      kdfParametersJson: existingProfile.kdfParametersJson,
    });
    return;
  }
  catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  await window.vectorCrypto.setAccountBackupPassword({
    accountId,
    password: accountPassword,
  });
}

export async function ensureAccountBackupProfileUnlocked(accountId: string): Promise<AccountBackupProfileResponseDto> {
  if (!window.vectorCrypto) {
    throw new Error('Local cryptography is not available.');
  }

  try {
    const existingProfile = await getCurrentAccountBackupProfile();
    await window.vectorCrypto.unlockAccountBackupProfile({
      accountId,
      encryptedBackupPrivateKeyBase64: existingProfile.encryptedBackupPrivateKeyBase64,
      kdfSaltBase64: existingProfile.kdfSaltBase64,
      privateKeyInitializationVectorBase64: existingProfile.privateKeyInitializationVectorBase64,
      privateKeyAuthenticationTagBase64: existingProfile.privateKeyAuthenticationTagBase64,
    });
    return existingProfile;
  }
  catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const createdProfile = await window.vectorCrypto.createAccountBackupProfile({ accountId });
    const savedProfile = await upsertCurrentAccountBackupProfile(createdProfile);
    await window.vectorCrypto.unlockAccountBackupProfile({
      accountId,
      encryptedBackupPrivateKeyBase64: savedProfile.encryptedBackupPrivateKeyBase64,
      kdfSaltBase64: savedProfile.kdfSaltBase64,
      privateKeyInitializationVectorBase64: savedProfile.privateKeyInitializationVectorBase64,
      privateKeyAuthenticationTagBase64: savedProfile.privateKeyAuthenticationTagBase64,
    });
    return savedProfile;
  }
}

export async function unlockAccountBackupProfileWithPassword(accountId: string, accountPassword: string): Promise<AccountBackupProfileResponseDto> {
  await prepareAccountBackupUnlockKey(accountId, accountPassword);
  return ensureAccountBackupProfileUnlocked(accountId);
}
