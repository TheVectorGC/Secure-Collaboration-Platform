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
  getOrCreateClientInstallationId: (namespace?: string | null) => Promise<string>;
  getHealth: () => Promise<VectorCryptoHealth>;
  initializeLocalVault: (request: InitializeLocalVaultRequest) => Promise<InitializeLocalVaultResponse>;
  getOrCreateDocumentSigningKey: (request: GetOrCreateDocumentSigningKeyRequest) => Promise<DocumentSigningKeyResponse>;
  signDocumentHash: (request: SignDocumentHashRequest) => Promise<SignDocumentHashResponse>;
  encryptMessage: (request: EncryptMessageRequest) => Promise<EncryptMessageResponse>;
  encryptLocalMessage: (request: EncryptLocalMessageRequest) => Promise<EncryptMessageResponse>;
  encryptGroupMessage: (request: EncryptGroupMessageRequest) => Promise<EncryptGroupMessageResponse>;
  decryptGroupMessage: (request: DecryptGroupMessageRequest) => Promise<DecryptGroupMessageResponse>;
  importGroupKey: (request: ImportGroupKeyRequest) => Promise<ImportGroupKeyResponse>;
  exportGroupKeyPackagesForChat: (request: ExportGroupKeyPackagesForChatRequest) => Promise<ExportGroupKeyPackagesForChatResponse>;
  decryptMessage: (request: DecryptMessageRequest) => Promise<DecryptMessageResponse>;
  exportEncryptedKeyBackup: (request: ExportEncryptedKeyBackupRequest) => Promise<ExportEncryptedKeyBackupResponse>;
  importEncryptedKeyBackup: (request: ImportEncryptedKeyBackupRequest) => Promise<ImportEncryptedKeyBackupResponse>;
  getRestoredDeviceIds: (request: GetRestoredDeviceIdsRequest) => Promise<string[]>;
  clearLocalVault: () => Promise<ClearLocalVaultResponse>;
};
