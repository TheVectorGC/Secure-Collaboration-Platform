export type VectorCryptoHealth = {
  available: boolean;
  safeStorageAvailable: boolean;
  cryptoDirectory: string | null;
  masterKeyExists: boolean;
  databasePath: string | null;
};

export type LocalPublicSignalKeyBundle = {
  generated: boolean;
  registrationId?: number;
  identityKey: {
    publicKey: string;
  };
  signedPreKey: {
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

export type ClearLocalVaultResponse = {
  cleared: boolean;
};

export type VectorCryptoApi = {
  getHealth: () => Promise<VectorCryptoHealth>;
  initializeLocalVault: (request: InitializeLocalVaultRequest) => Promise<InitializeLocalVaultResponse>;
  clearLocalVault: () => Promise<ClearLocalVaultResponse>;
};
