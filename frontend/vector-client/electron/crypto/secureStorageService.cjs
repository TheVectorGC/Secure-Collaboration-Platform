const { app, safeStorage } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MASTER_KEY_FILE_NAME = 'vector-master-key.bin';
const CLIENT_INSTALLATION_ID_FILE_NAME = 'vector-client-installation-id.bin';
const ACCOUNT_BACKUP_PRIVATE_KEY_FILE_PREFIX = 'vector-account-backup-private-key.';
const ACCOUNT_BACKUP_PRIVATE_KEY_FILE_SUFFIX = '.bin';

function getCryptoDirectory() {
  const cryptoDirectory = path.join(app.getPath('userData'), 'crypto');
  fs.mkdirSync(cryptoDirectory, { recursive: true });
  return cryptoDirectory;
}

function getMasterKeyFilePath() {
  return path.join(getCryptoDirectory(), MASTER_KEY_FILE_NAME);
}

function getClientInstallationIdFilePath() {
  return path.join(getCryptoDirectory(), CLIENT_INSTALLATION_ID_FILE_NAME);
}

function normalizeStorageFilePart(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('Storage key is required.');
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getAccountBackupPrivateKeyFilePath(accountId) {
  return path.join(
    getCryptoDirectory(),
    `${ACCOUNT_BACKUP_PRIVATE_KEY_FILE_PREFIX}${normalizeStorageFilePart(accountId)}${ACCOUNT_BACKUP_PRIVATE_KEY_FILE_SUFFIX}`
  );
}

function createMasterKey() {
  return crypto.randomBytes(32);
}

function encryptMasterKey(masterKey) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Electron safeStorage encryption is not available on this system.');
  }

  return safeStorage.encryptString(masterKey.toString('base64'));
}

function decryptMasterKey(encryptedMasterKey) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Electron safeStorage encryption is not available on this system.');
  }

  const serializedMasterKey = safeStorage.decryptString(encryptedMasterKey);
  return Buffer.from(serializedMasterKey, 'base64');
}

function getOrCreateMasterKey() {
  const masterKeyFilePath = getMasterKeyFilePath();

  if (fs.existsSync(masterKeyFilePath)) {
    const encryptedMasterKey = fs.readFileSync(masterKeyFilePath);
    return decryptMasterKey(encryptedMasterKey);
  }

  const masterKey = createMasterKey();
  const encryptedMasterKey = encryptMasterKey(masterKey);
  fs.writeFileSync(masterKeyFilePath, encryptedMasterKey, { mode: 0o600 });

  return masterKey;
}

function clearMasterKey() {
  const masterKeyFilePath = getMasterKeyFilePath();

  if (fs.existsSync(masterKeyFilePath)) {
    fs.rmSync(masterKeyFilePath, { force: true });
  }
}

function getOrCreateClientInstallationId() {
  const clientInstallationIdFilePath = getClientInstallationIdFilePath();

  if (fs.existsSync(clientInstallationIdFilePath)) {
    return safeStorage.decryptString(fs.readFileSync(clientInstallationIdFilePath));
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Electron safeStorage encryption is not available on this system.');
  }

  const clientInstallationId = crypto.randomUUID();
  const encryptedClientInstallationId = safeStorage.encryptString(clientInstallationId);
  fs.writeFileSync(clientInstallationIdFilePath, encryptedClientInstallationId, { mode: 0o600 });

  return clientInstallationId;
}

function saveAccountBackupPrivateKey(accountId, privateKeyBase64) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Electron safeStorage encryption is not available on this system.');
  }

  if (!privateKeyBase64 || typeof privateKeyBase64 !== 'string') {
    throw new Error('privateKeyBase64 is required.');
  }

  const encryptedPrivateKey = safeStorage.encryptString(privateKeyBase64);
  fs.writeFileSync(getAccountBackupPrivateKeyFilePath(accountId), encryptedPrivateKey, { mode: 0o600 });

  return { saved: true };
}

function loadAccountBackupPrivateKey(accountId) {
  const privateKeyFilePath = getAccountBackupPrivateKeyFilePath(accountId);

  if (!fs.existsSync(privateKeyFilePath)) {
    return null;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }

  return safeStorage.decryptString(fs.readFileSync(privateKeyFilePath));
}

function clearAccountBackupPrivateKey(accountId) {
  const privateKeyFilePath = getAccountBackupPrivateKeyFilePath(accountId);

  if (fs.existsSync(privateKeyFilePath)) {
    fs.rmSync(privateKeyFilePath, { force: true });
  }

  return { cleared: true };
}

function getHealth() {
  return {
    safeStorageAvailable: safeStorage.isEncryptionAvailable(),
    cryptoDirectory: getCryptoDirectory(),
    masterKeyExists: fs.existsSync(getMasterKeyFilePath()),
    clientInstallationIdExists: fs.existsSync(getClientInstallationIdFilePath()),
  };
}

module.exports = {
  getCryptoDirectory,
  getOrCreateClientInstallationId,
  getOrCreateMasterKey,
  clearMasterKey,
  saveAccountBackupPrivateKey,
  loadAccountBackupPrivateKey,
  clearAccountBackupPrivateKey,
  getHealth,
};
