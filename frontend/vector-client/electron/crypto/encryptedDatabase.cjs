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

    CREATE TABLE IF NOT EXISTS signal_sessions (
      account_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      recipient_account_id TEXT NOT NULL,
      recipient_device_id TEXT NOT NULL,
      session_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (account_id, device_id, recipient_account_id, recipient_device_id),
      FOREIGN KEY (account_id, device_id)
        REFERENCES local_devices(account_id, device_id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_signal_sessions_recipient
      ON signal_sessions(recipient_account_id, recipient_device_id);

    CREATE INDEX IF NOT EXISTS idx_one_time_prekeys_status
      ON one_time_prekeys(account_id, device_id, status);
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
