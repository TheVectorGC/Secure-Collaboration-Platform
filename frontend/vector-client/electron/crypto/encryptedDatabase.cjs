const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3-multiple-ciphers');
const secureStorageService = require('./secureStorageService.cjs');

const DATABASE_FILE_NAME = 'vector-crypto.db';

function getDatabaseFilePath() {
  return path.join(secureStorageService.getCryptoDirectory(), DATABASE_FILE_NAME);
}

function escapePragmaValue(value) {
  return String(value).replaceAll("'", "''");
}

function openDatabase() {
  const masterKey = secureStorageService.getOrCreateMasterKey();
  const database = new Database(getDatabaseFilePath());

  database.pragma(`key = '${escapePragmaValue(masterKey.toString('hex'))}'`);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  applySchema(database);

  return database;
}

function tableExists(database, tableName) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  return Boolean(row);
}

function columnExists(database, tableName, columnName) {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.some((row) => row.name === columnName);
}

function migrateLegacySchema(database) {
  if (tableExists(database, 'local_devices') && !columnExists(database, 'local_devices', 'registration_id')) {
    database.exec('ALTER TABLE local_devices ADD COLUMN registration_id INTEGER');
  }

  if (tableExists(database, 'signal_sessions') && !columnExists(database, 'signal_sessions', 'remote_address')) {
    database.exec('DROP INDEX IF EXISTS idx_signal_sessions_recipient');
    database.exec('DROP TABLE signal_sessions');
  }

  if (tableExists(database, 'trusted_identities') && !columnExists(database, 'trusted_identities', 'remote_address')) {
    database.exec('DROP TABLE trusted_identities');
  }
}

function applySchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS crypto_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_devices (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      registration_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, device_id)
    );

    CREATE TABLE IF NOT EXISTS identity_keys (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      public_key TEXT,
      private_key TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, device_id),
      FOREIGN KEY (account_id, device_id)
        REFERENCES local_devices(account_id, device_id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS signed_prekeys (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      key_id INTEGER NOT NULL,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      signature TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      PRIMARY KEY (account_id, device_id, key_id),
      FOREIGN KEY (account_id, device_id)
        REFERENCES local_devices(account_id, device_id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS one_time_prekeys (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      key_id INTEGER NOT NULL,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT,
      PRIMARY KEY (account_id, device_id, key_id),
      FOREIGN KEY (account_id, device_id)
        REFERENCES local_devices(account_id, device_id)
        ON DELETE CASCADE
    );
  `);

  migrateLegacySchema(database);

  database.exec(`
    CREATE TABLE IF NOT EXISTS kyber_prekeys (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      key_id INTEGER NOT NULL,
      public_key TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      signature TEXT NOT NULL,
      record_data TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT,
      expires_at TEXT,
      PRIMARY KEY (account_id, device_id, key_id),
      FOREIGN KEY (account_id, device_id)
        REFERENCES local_devices(account_id, device_id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS signal_sessions (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      remote_address TEXT NOT NULL,
      session_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, device_id, remote_address),
      FOREIGN KEY (account_id, device_id)
        REFERENCES local_devices(account_id, device_id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trusted_identities (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      remote_address TEXT NOT NULL,
      public_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, device_id, remote_address),
      FOREIGN KEY (account_id, device_id)
        REFERENCES local_devices(account_id, device_id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_signing_keys (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      public_key_base64 TEXT NOT NULL,
      private_key_base64 TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, device_id),
      FOREIGN KEY (account_id, device_id)
        REFERENCES local_devices(account_id, device_id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS decrypted_message_cache (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      plain_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, device_id, message_id),
      FOREIGN KEY (account_id, device_id)
        REFERENCES local_devices(account_id, device_id)
        ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS restored_local_message_keys (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      key_base64 TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, device_id)
    );


    CREATE TABLE IF NOT EXISTS group_keys (
      account_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      epoch INTEGER NOT NULL,
      sender_device_id TEXT NOT NULL,
      key_base64 TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, chat_id, epoch, sender_device_id)
    );

    CREATE INDEX IF NOT EXISTS idx_group_keys_account_chat
      ON group_keys(account_id, chat_id);

    CREATE INDEX IF NOT EXISTS idx_signal_sessions_remote_address
      ON signal_sessions(remote_address);

    CREATE INDEX IF NOT EXISTS idx_one_time_prekeys_status
      ON one_time_prekeys(account_id, device_id, status);

    CREATE INDEX IF NOT EXISTS idx_kyber_prekeys_status
      ON kyber_prekeys(account_id, device_id, status);
  `);
}

function clearDatabase() {
  const databaseFilePath = getDatabaseFilePath();
  const auxiliaryFilePaths = [
    databaseFilePath,
    `${databaseFilePath}-wal`,
    `${databaseFilePath}-shm`,
  ];

  auxiliaryFilePaths.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });
}

module.exports = {
  openDatabase,
  clearDatabase,
  getDatabaseFilePath,
};
