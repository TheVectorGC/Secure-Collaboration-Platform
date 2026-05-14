const encryptedDatabase = require('./encryptedDatabase.cjs');

function nowIso() {
  return new Date().toISOString();
}

function initializeLocalDevice(accountId, deviceId) {
  const database = encryptedDatabase.openDatabase();

  try {
    const existingDevice = database
      .prepare('SELECT account_id, device_id, registration_id, created_at, updated_at FROM local_devices WHERE account_id = ? AND device_id = ?')
      .get(accountId, deviceId);

    if (existingDevice) {
      database
        .prepare('UPDATE local_devices SET updated_at = ? WHERE account_id = ? AND device_id = ?')
        .run(nowIso(), accountId, deviceId);

      return {
        accountId: existingDevice.account_id,
        deviceId: existingDevice.device_id,
        registrationId: existingDevice.registration_id,
        createdAt: existingDevice.created_at,
        alreadyExisted: true,
      };
    }

    const registrationId = Math.floor(Math.random() * 16380) + 1;
    const createdAt = nowIso();

    database
      .prepare(`
        INSERT INTO local_devices(account_id, device_id, registration_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(accountId, deviceId, registrationId, createdAt, createdAt);

    database
      .prepare(`
        INSERT OR REPLACE INTO crypto_metadata(key, value, updated_at)
        VALUES (?, ?, ?)
      `)
      .run('schemaVersion', '1', createdAt);

    return {
      accountId,
      deviceId,
      registrationId,
      createdAt,
      alreadyExisted: false,
    };
  }
  finally {
    database.close();
  }
}

module.exports = {
  initializeLocalDevice,
};
