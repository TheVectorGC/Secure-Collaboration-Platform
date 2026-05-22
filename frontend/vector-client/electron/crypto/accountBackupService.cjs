const crypto = require('node:crypto');

const BACKUP_KDF_ALGORITHM = 'scrypt';
const BACKUP_KDF_PARAMETERS = {
  n: 32768,
  r: 8,
  p: 1,
  keyLength: 32,
  maxmem: 67108864,
};

const accountBackupUnlockKeyByAccountId = new Map();
const accountBackupPrivateKeyByAccountId = new Map();

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function fromBase64(value) {
  return Buffer.from(value, 'base64');
}

function validateAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('accountId is required.');
  }
}

function parseKdfParameters(kdfParametersJson) {
  if (!kdfParametersJson) {
    return BACKUP_KDF_PARAMETERS;
  }

  return JSON.parse(kdfParametersJson);
}

function buildBackupKdfSalt(accountId, salt) {
  return crypto
    .createHash('sha256')
    .update('vector-account-backup-v1')
    .update(':')
    .update(accountId)
    .update(':')
    .update(salt)
    .digest();
}

function deriveBackupKey(accountId, accountPassword, salt, kdfParameters) {
  return crypto.scryptSync(
    accountPassword,
    buildBackupKdfSalt(accountId, salt),
    kdfParameters.keyLength,
    {
      N: kdfParameters.n,
      r: kdfParameters.r,
      p: kdfParameters.p,
      maxmem: kdfParameters.maxmem,
    }
  );
}

function setAccountBackupPassword(request) {
  validateAccountId(request?.accountId);

  if (!request.password || typeof request.password !== 'string') {
    throw new Error('Account password is required.');
  }

  const kdfParameters = parseKdfParameters(request.kdfParametersJson);
  const salt = request.kdfSaltBase64 ? fromBase64(request.kdfSaltBase64) : crypto.randomBytes(32);
  const backupKey = deriveBackupKey(request.accountId, request.password, salt, kdfParameters);

  accountBackupUnlockKeyByAccountId.set(request.accountId, {
    key: backupKey,
    kdfSaltBase64: toBase64(salt),
    kdfParameters,
    kdfParametersJson: JSON.stringify(kdfParameters),
  });

  return {
    stored: true,
    kdfSaltBase64: toBase64(salt),
  };
}

function clearAccountBackupPassword(request) {
  validateAccountId(request?.accountId);
  const sessionKey = accountBackupUnlockKeyByAccountId.get(request.accountId);

  if (sessionKey?.key && Buffer.isBuffer(sessionKey.key)) {
    sessionKey.key.fill(0);
  }

  accountBackupUnlockKeyByAccountId.delete(request.accountId);
  accountBackupPrivateKeyByAccountId.delete(request.accountId);

  return { cleared: true };
}

function hasAccountBackupPassword(accountId) {
  validateAccountId(accountId);
  return accountBackupUnlockKeyByAccountId.has(accountId);
}

function hasUnlockedAccountBackupPrivateKey(accountId) {
  validateAccountId(accountId);
  return accountBackupPrivateKeyByAccountId.has(accountId);
}

function resolveAccountBackupUnlockKey(accountId, backup) {
  const sessionKey = accountBackupUnlockKeyByAccountId.get(accountId);

  if (!sessionKey?.key) {
    throw new Error('Backup unlock key is not available in this session. Sign in again or confirm your password.');
  }

  if (backup?.kdfSaltBase64 && sessionKey.kdfSaltBase64 !== backup.kdfSaltBase64) {
    throw new Error('Backup unlock key belongs to another backup salt. Sign in again to refresh the session key.');
  }

  return sessionKey;
}

function encryptWithAesGcm(key, plainTextBuffer) {
  const initializationVector = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, initializationVector);
  const ciphertext = Buffer.concat([cipher.update(plainTextBuffer), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return {
    initializationVectorBase64: toBase64(initializationVector),
    authenticationTagBase64: toBase64(authenticationTag),
    ciphertextBase64: toBase64(ciphertext),
  };
}

function decryptWithAesGcm(key, initializationVectorBase64, authenticationTagBase64, ciphertextBase64) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, fromBase64(initializationVectorBase64));
  decipher.setAuthTag(fromBase64(authenticationTagBase64));
  return Buffer.concat([decipher.update(fromBase64(ciphertextBase64)), decipher.final()]);
}

function createAccountBackupProfile(request) {
  validateAccountId(request?.accountId);
  const sessionKey = resolveAccountBackupUnlockKey(request.accountId);
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });
  const encryptedPrivateKey = encryptWithAesGcm(sessionKey.key, keyPair.privateKey);
  accountBackupPrivateKeyByAccountId.set(request.accountId, toBase64(keyPair.privateKey));

  return {
    backupPublicKeyBase64: toBase64(keyPair.publicKey),
    encryptedBackupPrivateKeyBase64: encryptedPrivateKey.ciphertextBase64,
    kdfAlgorithm: BACKUP_KDF_ALGORITHM,
    kdfSaltBase64: sessionKey.kdfSaltBase64,
    kdfParametersJson: sessionKey.kdfParametersJson,
    privateKeyEncryptionAlgorithm: 'AES-256-GCM',
    privateKeyInitializationVectorBase64: encryptedPrivateKey.initializationVectorBase64,
    privateKeyAuthenticationTagBase64: encryptedPrivateKey.authenticationTagBase64,
  };
}

function unlockAccountBackupProfile(request) {
  validateAccountId(request?.accountId);
  const sessionKey = resolveAccountBackupUnlockKey(request.accountId, {
    kdfSaltBase64: request.kdfSaltBase64,
  });
  const privateKeyDer = decryptWithAesGcm(
    sessionKey.key,
    request.privateKeyInitializationVectorBase64,
    request.privateKeyAuthenticationTagBase64,
    request.encryptedBackupPrivateKeyBase64
  );
  accountBackupPrivateKeyByAccountId.set(request.accountId, toBase64(privateKeyDer));

  return {
    unlocked: true,
  };
}

function encryptAccountKeyEnvelope(request) {
  if (!request?.backupPublicKeyBase64 || !request?.keyBase64) {
    throw new Error('backupPublicKeyBase64 and keyBase64 are required.');
  }

  const publicKey = crypto.createPublicKey({
    key: fromBase64(request.backupPublicKeyBase64),
    type: 'spki',
    format: 'der',
  });
  const ciphertext = crypto.publicEncrypt({
    key: publicKey,
    oaepHash: 'sha256',
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  }, fromBase64(request.keyBase64));

  return {
    algorithm: 'RSA-OAEP-SHA256',
    encryptedKeyBase64: toBase64(ciphertext),
  };
}

function decryptAccountKeyEnvelope(request) {
  validateAccountId(request?.accountId);

  if (!request.encryptedKeyBase64) {
    throw new Error('encryptedKeyBase64 is required.');
  }

  const privateKeyBase64 = accountBackupPrivateKeyByAccountId.get(request.accountId);

  if (!privateKeyBase64) {
    throw new Error('Account backup private key is not unlocked. Sign in again.');
  }

  const privateKey = crypto.createPrivateKey({
    key: fromBase64(privateKeyBase64),
    type: 'pkcs8',
    format: 'der',
  });
  const plainKey = crypto.privateDecrypt({
    key: privateKey,
    oaepHash: 'sha256',
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  }, fromBase64(request.encryptedKeyBase64));

  return {
    keyBase64: toBase64(plainKey),
  };
}

module.exports = {
  setAccountBackupPassword,
  clearAccountBackupPassword,
  hasAccountBackupPassword,
  hasUnlockedAccountBackupPrivateKey,
  createAccountBackupProfile,
  unlockAccountBackupProfile,
  encryptAccountKeyEnvelope,
  decryptAccountKeyEnvelope,
};
