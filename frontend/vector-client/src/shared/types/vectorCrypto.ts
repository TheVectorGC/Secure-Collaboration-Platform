
export type DeviceEnvironmentResponse = {
  platform: 'WINDOWS' | 'MACOS' | 'LINUX' | 'ANDROID' | 'IOS' | 'WEB';
  deviceName: string;
  clientVersion: string;
  osName: string;
  osVersion: string;
  architecture: string;
  hostname: string;
};

export type VectorCryptoHealth = {
  available: boolean;
  safeStorageAvailable: boolean;
  cryptoDirectory: string | null;
  masterKeyExists: boolean;
  databasePath: string | null;
};

export type LocalPublicSignalKeyBundle = {
  generated: boolean;
  registrationId: number;
  identityKey: {
    publicKey: string;
  };
  signedPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
    expiresAt: string | null;
  };
  kyberPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
    expiresAt: string | null;
  };
  oneTimePreKeys: Array<{
    keyId: number;
    publicKey: string;
  }>;
};

export type InitializeLocalVaultRequest = {
  accountId: string;
  deviceId: string;
  oneTimePreKeyCount?: number;
};

export type InitializeLocalVaultResponse = {
  ready: boolean;
  accountId: string;
  deviceId: string;
  registrationId: number;
  createdAt: string;
  alreadyExisted: boolean;
  databasePath: string;
  signalKeyBundle: LocalPublicSignalKeyBundle;
};

export type PreKeyBundleResponseDto = {
  deviceId: string;
  registrationId: number;
  identityKey: {
    publicKey: string;
    fingerprint: string;
    createdAt: string;
  };
  signedPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  kyberPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePreKey: {
    keyId: number;
    publicKey: string;
  } | null;
};

export type EncryptMessageRequest = {
  accountId: string;
  deviceId: string;
  targetDeviceId: string;
  plainText: string;
  preKeyBundle: PreKeyBundleResponseDto;
};

export type EncryptMessageResponse = {
  ciphertextType: 'PRE_KEY' | 'SIGNAL' | 'LOCAL';
  encryptedPayload: string;
};

export type EncryptLocalMessageRequest = {
  accountId: string;
  deviceId: string;
  plainText: string;
};

export type DecryptMessageRequest = {
  accountId: string;
  deviceId: string;
  messageId?: string;
  remoteDeviceId: string;
  ciphertextType: 'PRE_KEY' | 'SIGNAL' | 'LOCAL';
  encryptedPayload: string;
  allowFailure?: boolean;
};

export type DecryptMessageResponse = {
  plainText: string | null;
  fromCache?: boolean;
  failed?: boolean;
  errorMessage?: string;
};

export type DecryptGroupMessageResponse = {
  plainText: string | null;
  missingGroupKey?: boolean;
  fromCache?: boolean;
};

export type ClearLocalVaultResponse = {
  cleared: boolean;
};

export type DocumentSigningKeyResponse = {
  publicKeyBase64: string;
  privateKeyBase64: string;
  fingerprint: string;
  createdAt: string;
  alreadyExisted: boolean;
};

export type GetOrCreateDocumentSigningKeyRequest = {
  accountId: string;
  deviceId: string;
};

export type SignDocumentHashRequest = {
  accountId: string;
  deviceId: string;
  documentHashBase64: string;
};

export type SignDocumentHashResponse = {
  signatureBase64: string;
  signingKeyFingerprint: string;
};



export type EncryptGroupMessageRequest = {
  accountId: string;
  deviceId: string;
  chatId: string;
  epoch: number;
  plainText: string;
};

export type EncryptGroupMessageResponse = {
  encryptionType: 'GROUP';
  encryptedPayload: string;
  groupKeyPackagePlainText: string;
};

export type DecryptGroupMessageRequest = {
  accountId: string;
  deviceId: string;
  chatId: string;
  epoch?: number;
  messageId?: string;
  encryptedPayload: string;
};

export type ImportGroupKeyRequest = {
  accountId: string;
  chatId: string;
  groupKeyPackagePlainText: string;
};

export type ImportGroupKeyResponse = {
  imported: boolean;
  chatId: string;
  epoch: number;
};

export type ExportGroupKeyPackagesForChatRequest = {
  accountId: string;
  chatId: string;
};

export type ExportGroupKeyPackagesForChatResponse = {
  chatId: string;
  packages: string[];
};



export type SetAccountBackupPasswordRequest = {
  accountId: string;
  password: string;
  kdfSaltBase64?: string;
  kdfParametersJson?: string;
};

export type ClearAccountBackupPasswordRequest = {
  accountId: string;
};

export type HasAccountBackupPasswordRequest = {
  accountId: string;
};






export type ClearAccountLocalVaultRequest = {
  accountId: string;
};

export type EncryptContentWithNewKeyRequest = {
  plainText: string;
};

export type EncryptContentWithNewKeyResponse = {
  algorithm: 'AES-256-GCM';
  keyBase64: string;
  encryptedPayload: string;
  initializationVectorBase64: string;
  authenticationTagBase64: string;
};

export type DecryptContentWithKeyRequest = {
  keyBase64: string;
  encryptedPayload: string;
  initializationVectorBase64: string;
  authenticationTagBase64: string;
};

export type CreateAccountBackupProfileRequest = {
  accountId: string;
};

export type CreateAccountBackupProfileResponse = {
  backupPublicKeyBase64: string;
  encryptedBackupPrivateKeyBase64: string;
  kdfAlgorithm: string;
  kdfSaltBase64: string;
  kdfParametersJson: string;
  privateKeyEncryptionAlgorithm: string;
  privateKeyInitializationVectorBase64: string;
  privateKeyAuthenticationTagBase64: string;
};

export type UnlockAccountBackupProfileRequest = {
  accountId: string;
  encryptedBackupPrivateKeyBase64: string;
  kdfSaltBase64: string;
  privateKeyInitializationVectorBase64: string;
  privateKeyAuthenticationTagBase64: string;
};

export type EncryptAccountKeyEnvelopeRequest = {
  backupPublicKeyBase64: string;
  keyBase64: string;
};

export type EncryptAccountKeyEnvelopeResponse = {
  algorithm: 'RSA-OAEP-SHA256';
  encryptedKeyBase64: string;
};

export type DecryptAccountKeyEnvelopeRequest = {
  accountId: string;
  encryptedKeyBase64: string;
};

export type DecryptAccountKeyEnvelopeResponse = {
  keyBase64: string;
};

export type EncryptGroupMessageV2Request = EncryptGroupMessageRequest & {
  messageId: string;
};

export type EncryptGroupMessageV2Response = {
  encryptionType: 'GROUP';
  algorithm: 'AES-256-GCM';
  encryptedPayload: string;
  initializationVectorBase64: string;
  authenticationTagBase64: string;
  groupEpochKeyBase64: string;
  groupKeyPackagePlainText: string;
};

export type DecryptGroupMessageV2Request = {
  accountId: string;
  deviceId: string;
  chatId: string;
  epoch: number;
  messageId: string;
  encryptedPayload: string;
  initializationVectorBase64: string;
  authenticationTagBase64: string;
};

export type GetOrCreateGroupEpochKeyRequest = {
  accountId: string;
  deviceId: string;
  chatId: string;
  epoch: number;
};

export type ImportGroupKeyFromBackupEnvelopeRequest = {
  accountId: string;
  chatId: string;
  epoch: number;
  senderDeviceId: string;
  groupEpochKeyBase64: string;
};

export type VectorCryptoApi = {
  getOrCreateClientInstallationId: () => Promise<string>;
  getDeviceEnvironment: () => Promise<DeviceEnvironmentResponse>;
  getHealth: () => Promise<VectorCryptoHealth>;
  initializeLocalVault: (request: InitializeLocalVaultRequest) => Promise<InitializeLocalVaultResponse>;
  getOrCreateDocumentSigningKey: (request: GetOrCreateDocumentSigningKeyRequest) => Promise<DocumentSigningKeyResponse>;
  signDocumentHash: (request: SignDocumentHashRequest) => Promise<SignDocumentHashResponse>;
  encryptContentWithNewKey: (request: EncryptContentWithNewKeyRequest) => Promise<EncryptContentWithNewKeyResponse>;
  decryptContentWithKey: (request: DecryptContentWithKeyRequest) => Promise<DecryptMessageResponse>;
  createAccountBackupProfile: (request: CreateAccountBackupProfileRequest) => Promise<CreateAccountBackupProfileResponse>;
  unlockAccountBackupProfile: (request: UnlockAccountBackupProfileRequest) => Promise<{ unlocked: boolean }>;
  encryptAccountKeyEnvelope: (request: EncryptAccountKeyEnvelopeRequest) => Promise<EncryptAccountKeyEnvelopeResponse>;
  decryptAccountKeyEnvelope: (request: DecryptAccountKeyEnvelopeRequest) => Promise<DecryptAccountKeyEnvelopeResponse>;
  getOrCreateGroupEpochKey: (request: GetOrCreateGroupEpochKeyRequest) => Promise<{ chatId: string; epoch: number; senderDeviceId: string; groupEpochKeyBase64: string; groupKeyPackagePlainText: string }>;
  importGroupKeyFromBackupEnvelope: (request: ImportGroupKeyFromBackupEnvelopeRequest) => Promise<{ imported: boolean; senderDeviceId?: string }>;
  encryptGroupMessageV2: (request: EncryptGroupMessageV2Request) => Promise<EncryptGroupMessageV2Response>;
  decryptGroupMessageV2: (request: DecryptGroupMessageV2Request) => Promise<DecryptGroupMessageResponse>;
  encryptMessage: (request: EncryptMessageRequest) => Promise<EncryptMessageResponse>;
  encryptLocalMessage: (request: EncryptLocalMessageRequest) => Promise<EncryptMessageResponse>;
  exportGroupKeyPackagesForChat: (request: ExportGroupKeyPackagesForChatRequest) => Promise<ExportGroupKeyPackagesForChatResponse>;
  decryptMessage: (request: DecryptMessageRequest) => Promise<DecryptMessageResponse>;
  setAccountBackupPassword: (request: SetAccountBackupPasswordRequest) => Promise<{ stored: boolean; kdfSaltBase64: string }>;
  clearAccountBackupPassword: (request: ClearAccountBackupPasswordRequest) => Promise<{ cleared: boolean }>;
  hasAccountBackupPassword: (request: HasAccountBackupPasswordRequest) => Promise<boolean>;
  hasUnlockedAccountBackupPrivateKey: (request: HasAccountBackupPasswordRequest) => Promise<boolean>;
  clearAccountLocalVault: (request: ClearAccountLocalVaultRequest) => Promise<ClearLocalVaultResponse>;
  clearLocalVault: () => Promise<ClearLocalVaultResponse>;
};
