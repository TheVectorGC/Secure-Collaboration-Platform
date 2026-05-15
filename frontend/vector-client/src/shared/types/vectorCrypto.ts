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
  remoteDeviceId: string;
  ciphertextType: 'PRE_KEY' | 'SIGNAL' | 'LOCAL';
  encryptedPayload: string;
};

export type DecryptMessageResponse = {
  plainText: string;
};

export type ClearLocalVaultResponse = {
  cleared: boolean;
};

export type VectorCryptoApi = {
  getOrCreateClientInstallationId: () => Promise<string>;
  getHealth: () => Promise<VectorCryptoHealth>;
  initializeLocalVault: (request: InitializeLocalVaultRequest) => Promise<InitializeLocalVaultResponse>;
  encryptMessage: (request: EncryptMessageRequest) => Promise<EncryptMessageResponse>;
  encryptLocalMessage: (request: EncryptLocalMessageRequest) => Promise<EncryptMessageResponse>;
  decryptMessage: (request: DecryptMessageRequest) => Promise<DecryptMessageResponse>;
  clearLocalVault: () => Promise<ClearLocalVaultResponse>;
};
