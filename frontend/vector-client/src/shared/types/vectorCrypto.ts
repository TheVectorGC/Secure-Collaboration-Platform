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
};

export type DecryptMessageResponse = {
  plainText: string;
  fromCache?: boolean;
};

export type ClearLocalVaultResponse = {
  cleared: boolean;
};


export type ExportEncryptedKeyBackupRequest = {
  accountId: string;
  recoveryPassword: string;
};

export type ExportEncryptedKeyBackupResponse = {
  backupVersion: number;
  kdfAlgorithm: string;
  kdfSaltBase64: string;
  kdfParametersJson: string;
  encryptionAlgorithm: string;
  initializationVectorBase64: string;
  authenticationTagBase64: string;
  encryptedBackupBlobBase64: string;
  exportedDeviceIds: string[];
};

export type ImportEncryptedKeyBackupRequest = {
  accountId: string;
  recoveryPassword: string;
  backup: {
    backupVersion: number;
    kdfAlgorithm: string;
    kdfSaltBase64: string;
    kdfParametersJson: string;
    encryptionAlgorithm: string;
    initializationVectorBase64: string;
    authenticationTagBase64: string;
    encryptedBackupBlobBase64: string;
  };
};

export type ImportEncryptedKeyBackupResponse = {
  imported: boolean;
  accountId: string;
  importedDeviceIds: string[];
  exportedAt: string;
};

export type GetRestoredDeviceIdsRequest = {
  accountId: string;
};

export type VectorCryptoApi = {
  getOrCreateClientInstallationId: () => Promise<string>;
  getHealth: () => Promise<VectorCryptoHealth>;
  initializeLocalVault: (request: InitializeLocalVaultRequest) => Promise<InitializeLocalVaultResponse>;
  encryptMessage: (request: EncryptMessageRequest) => Promise<EncryptMessageResponse>;
  encryptLocalMessage: (request: EncryptLocalMessageRequest) => Promise<EncryptMessageResponse>;
  decryptMessage: (request: DecryptMessageRequest) => Promise<DecryptMessageResponse>;
  exportEncryptedKeyBackup: (request: ExportEncryptedKeyBackupRequest) => Promise<ExportEncryptedKeyBackupResponse>;
  importEncryptedKeyBackup: (request: ImportEncryptedKeyBackupRequest) => Promise<ImportEncryptedKeyBackupResponse>;
  getRestoredDeviceIds: (request: GetRestoredDeviceIdsRequest) => Promise<string[]>;
  clearLocalVault: () => Promise<ClearLocalVaultResponse>;
};
