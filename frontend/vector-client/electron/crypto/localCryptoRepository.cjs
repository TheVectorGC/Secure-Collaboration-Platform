const crypto = require('node:crypto');
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


function calculateSha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getOrCreateDocumentSigningKey(accountId, deviceId) {
  if (!accountId || !deviceId) {
    throw new Error('accountId and deviceId are required for document signing key.');
  }

  const database = encryptedDatabase.openDatabase();

  try {
    const existingKey = database
      .prepare(`
        SELECT public_key_base64, private_key_base64, fingerprint, created_at
        FROM document_signing_keys
        WHERE account_id = ? AND device_id = ?
      `)
      .get(accountId, deviceId);

    if (existingKey) {
      return {
        publicKeyBase64: existingKey.public_key_base64,
        privateKeyBase64: existingKey.private_key_base64,
        fingerprint: existingKey.fingerprint,
        createdAt: existingKey.created_at,
        alreadyExisted: true,
      };
    }

    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
    const privateKeyDer = keyPair.privateKey.export({ type: 'pkcs8', format: 'der' });
    const createdAt = nowIso();
    const publicKeyBase64 = publicKeyDer.toString('base64');
    const privateKeyBase64 = privateKeyDer.toString('base64');
    const fingerprint = calculateSha256Hex(publicKeyDer);

    database
      .prepare(`
        INSERT INTO document_signing_keys(account_id, device_id, public_key_base64, private_key_base64, fingerprint, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(accountId, deviceId, publicKeyBase64, privateKeyBase64, fingerprint, createdAt, createdAt);

    return {
      publicKeyBase64,
      privateKeyBase64,
      fingerprint,
      createdAt,
      alreadyExisted: false,
    };
  }
  finally {
    database.close();
  }
}

function signDocumentHash(accountId, deviceId, documentHashBase64) {
  if (!documentHashBase64 || typeof documentHashBase64 !== 'string') {
    throw new Error('documentHashBase64 is required.');
  }

  const signingKey = getOrCreateDocumentSigningKey(accountId, deviceId);
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(signingKey.privateKeyBase64, 'base64'),
    type: 'pkcs8',
    format: 'der',
  });
  const documentHashBytes = Buffer.from(documentHashBase64, 'base64');
  const signature = crypto.sign(null, documentHashBytes, privateKey);

  return {
    signatureBase64: signature.toString('base64'),
    signingKeyFingerprint: signingKey.fingerprint,
  };
}

function clearAccountCryptoState(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('accountId is required to clear account crypto state.');
  }

  const database = encryptedDatabase.openDatabase();

  try {
    database.transaction(() => {
      const tableNames = [
        'group_keys',
        'document_signing_keys',
        'trusted_identities',
        'signal_sessions',
        'kyber_prekeys',
        'one_time_prekeys',
        'signed_prekeys',
        'identity_keys',
        'local_devices',
      ];

      for (const tableName of tableNames) {
        database.prepare(`DELETE FROM ${tableName} WHERE account_id = ?`).run(accountId);
      }
    })();
  }
  finally {
    database.close();
  }
}

module.exports = {
  initializeLocalDevice,
  getOrCreateDocumentSigningKey,
  signDocumentHash,
  clearAccountCryptoState,
};
