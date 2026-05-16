const crypto = require('node:crypto');
const encryptedDatabase = require('./encryptedDatabase.cjs');
const secureStorageService = require('./secureStorageService.cjs');
const localCryptoRepository = require('./localCryptoRepository.cjs');

const BACKUP_FORMAT_VERSION = 1;
const BACKUP_ENCRYPTION_ALGORITHM = 'AES-256-GCM';
const BACKUP_KDF_ALGORITHM = 'scrypt';
const BACKUP_KDF_PARAMETERS = {
  n: 32768,
  r: 8,
  p: 1,
  keyLength: 32,
  maxmem: 67108864,
};
const BACKUP_TABLES = [
  'local_devices',
  'identity_keys',
  'signed_prekeys',
  'one_time_prekeys',
  'kyber_prekeys',
  'signal_sessions',
  'trusted_identities',
  'document_signing_keys',
  'decrypted_message_cache',
  'restored_local_message_keys',
];

function nowIso() {
  return new Date().toISOString();
}

function validateAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('accountId is required.');
  }
}

function validateRecoveryPassword(recoveryPassword) {
  if (!recoveryPassword || typeof recoveryPassword !== 'string' || recoveryPassword.length < 12) {
    throw new Error('Recovery password must contain at least 12 characters.');
  }
}

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function fromBase64(value) {
  return Buffer.from(value, 'base64');
}

function deriveBackupKey(recoveryPassword, salt, kdfParameters) {
  return crypto.scryptSync(
    recoveryPassword,
    salt,
    kdfParameters.keyLength,
    {
      N: kdfParameters.n,
      r: kdfParameters.r,
      p: kdfParameters.p,
      maxmem: kdfParameters.maxmem,
    }
  );
}

function tableExists(database, tableName) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  return Boolean(row);
}

function readAccountRows(database, tableName, accountId) {
  if (!tableExists(database, tableName)) {
    return [];
  }

  return database
    .prepare(`SELECT * FROM ${tableName} WHERE account_id = ?`)
    .all(accountId);
}

function mergeRowsByDeviceId(existingRows, newRows) {
  const rowsByDeviceId = new Map();

  for (const row of existingRows ?? []) {
    rowsByDeviceId.set(row.device_id, row);
  }

  for (const row of newRows ?? []) {
    rowsByDeviceId.set(row.device_id, row);
  }

  return [...rowsByDeviceId.values()];
}

function buildLocalAssociatedData(accountId, deviceId) {
  return Buffer.from(`vector-local-message:${accountId}:${deviceId}`, 'utf8');
}

function deriveLocalMessageKey(accountId, deviceId) {
  const masterKey = secureStorageService.getOrCreateMasterKey();

  return crypto
    .createHmac('sha256', masterKey)
    .update(buildLocalAssociatedData(accountId, deviceId))
    .digest();
}

function buildLocalMessageKeyBackups(accountId, localDevices) {
  return localDevices.map((localDevice) => ({
    account_id: accountId,
    device_id: localDevice.device_id,
    key_base64: toBase64(deriveLocalMessageKey(accountId, localDevice.device_id)),
    created_at: nowIso(),
    updated_at: nowIso(),
  }));
}

function buildPlainBackupArchive(database, accountId) {
  const tables = {};

  for (const tableName of BACKUP_TABLES) {
    tables[tableName] = readAccountRows(database, tableName, accountId);
  }

  const exportedDeviceIds = tables.local_devices.map((localDevice) => localDevice.device_id);
  const localMessageKeys = buildLocalMessageKeyBackups(accountId, tables.local_devices);

  tables.restored_local_message_keys = mergeRowsByDeviceId(
    tables.restored_local_message_keys,
    localMessageKeys
  );

  return {
    version: BACKUP_FORMAT_VERSION,
    accountId,
    exportedAt: nowIso(),
    exportedDeviceIds,
    tables,
  };
}

function exportEncryptedKeyBackup(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Key backup export request is required.');
  }

  validateAccountId(request.accountId);
  validateRecoveryPassword(request.recoveryPassword);

  const database = encryptedDatabase.openDatabase();

  try {
    const archive = buildPlainBackupArchive(database, request.accountId);

    if (archive.exportedDeviceIds.length === 0) {
      throw new Error('There are no local crypto devices to back up.');
    }

    const salt = crypto.randomBytes(32);
    const initializationVector = crypto.randomBytes(12);
    const backupKey = deriveBackupKey(request.recoveryPassword, salt, BACKUP_KDF_PARAMETERS);
    const associatedData = Buffer.from(`vector-key-backup:${request.accountId}:v${BACKUP_FORMAT_VERSION}`, 'utf8');
    const cipher = crypto.createCipheriv('aes-256-gcm', backupKey, initializationVector);

    cipher.setAAD(associatedData);

    const encryptedBackupBlob = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(archive), 'utf8')),
      cipher.final(),
    ]);
    const authenticationTag = cipher.getAuthTag();

    return {
      backupVersion: Date.now(),
      kdfAlgorithm: BACKUP_KDF_ALGORITHM,
      kdfSaltBase64: toBase64(salt),
      kdfParametersJson: JSON.stringify(BACKUP_KDF_PARAMETERS),
      encryptionAlgorithm: BACKUP_ENCRYPTION_ALGORITHM,
      initializationVectorBase64: toBase64(initializationVector),
      authenticationTagBase64: toBase64(authenticationTag),
      encryptedBackupBlobBase64: toBase64(encryptedBackupBlob),
      exportedDeviceIds: archive.exportedDeviceIds,
    };
  }
  finally {
    database.close();
  }
}

function decryptBackupArchive(accountId, recoveryPassword, backup) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('Encrypted key backup is required.');
  }

  if (backup.encryptionAlgorithm !== BACKUP_ENCRYPTION_ALGORITHM) {
    throw new Error('Unsupported key backup encryption algorithm.');
  }

  if (backup.kdfAlgorithm !== BACKUP_KDF_ALGORITHM) {
    throw new Error('Unsupported key backup KDF algorithm.');
  }

  const kdfParameters = JSON.parse(backup.kdfParametersJson);
  const salt = fromBase64(backup.kdfSaltBase64);
  const initializationVector = fromBase64(backup.initializationVectorBase64);
  const authenticationTag = fromBase64(backup.authenticationTagBase64);
  const encryptedBackupBlob = fromBase64(backup.encryptedBackupBlobBase64);
  const backupKey = deriveBackupKey(recoveryPassword, salt, kdfParameters);
  const associatedData = Buffer.from(`vector-key-backup:${accountId}:v${BACKUP_FORMAT_VERSION}`, 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-gcm', backupKey, initializationVector);

  decipher.setAAD(associatedData);
  decipher.setAuthTag(authenticationTag);

  const plainBackupBytes = Buffer.concat([
    decipher.update(encryptedBackupBlob),
    decipher.final(),
  ]);
  const archive = JSON.parse(plainBackupBytes.toString('utf8'));

  if (archive.version !== BACKUP_FORMAT_VERSION) {
    throw new Error('Unsupported key backup archive version.');
  }

  if (archive.accountId !== accountId) {
    throw new Error('Key backup belongs to another account.');
  }

  return archive;
}

function upsertRows(database, tableName, rows) {
  if (!Array.isArray(rows) || rows.length === 0 || !tableExists(database, tableName)) {
    return;
  }

  const columnNames = Object.keys(rows[0]);
  const placeholders = columnNames.map(() => '?').join(', ');
  const statement = database.prepare(`
    INSERT OR REPLACE INTO ${tableName}(${columnNames.join(', ')})
    VALUES (${placeholders})
  `);

  for (const row of rows) {
    statement.run(...columnNames.map((columnName) => row[columnName]));
  }
}

function importEncryptedKeyBackup(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Key backup import request is required.');
  }

  validateAccountId(request.accountId);
  validateRecoveryPassword(request.recoveryPassword);

  const archive = decryptBackupArchive(request.accountId, request.recoveryPassword, request.backup);
  const database = encryptedDatabase.openDatabase();

  try {
    database.transaction(() => {
      for (const tableName of BACKUP_TABLES) {
        upsertRows(database, tableName, archive.tables[tableName]);
      }
    })();

    return {
      imported: true,
      accountId: archive.accountId,
      importedDeviceIds: archive.exportedDeviceIds,
      exportedAt: archive.exportedAt,
    };
  }
  finally {
    database.close();
  }
}

function getRestoredDeviceIds(accountId) {
  validateAccountId(accountId);

  const database = encryptedDatabase.openDatabase();

  try {
    return database
      .prepare(`
        SELECT DISTINCT local_devices.device_id AS device_id
        FROM local_devices
        INNER JOIN identity_keys
          ON identity_keys.account_id = local_devices.account_id
         AND identity_keys.device_id = local_devices.device_id
        WHERE local_devices.account_id = ?
        ORDER BY local_devices.updated_at DESC
      `)
      .all(accountId)
      .map((row) => row.device_id);
  }
  finally {
    database.close();
  }
}

module.exports = {
  exportEncryptedKeyBackup,
  importEncryptedKeyBackup,
  getRestoredDeviceIds,
};
