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

function getCachedDecryptedMessage(accountId, deviceId, messageId) {
  if (!accountId || !deviceId || !messageId) {
    return null;
  }

  const database = encryptedDatabase.openDatabase();

  try {
    const cachedMessage = database
      .prepare(`
        SELECT plain_text
        FROM decrypted_message_cache
        WHERE account_id = ? AND device_id = ? AND message_id = ?
      `)
      .get(accountId, deviceId, messageId);

    return cachedMessage?.plain_text ?? null;
  }
  finally {
    database.close();
  }
}

function saveCachedDecryptedMessage(accountId, deviceId, messageId, plainText) {
  if (!accountId || !deviceId || !messageId || typeof plainText !== 'string') {
    return;
  }

  const database = encryptedDatabase.openDatabase();
  const timestamp = nowIso();

  try {
    database
      .prepare(`
        INSERT INTO decrypted_message_cache(account_id, device_id, message_id, plain_text, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, device_id, message_id)
        DO UPDATE SET plain_text = excluded.plain_text, updated_at = excluded.updated_at
      `)
      .run(accountId, deviceId, messageId, plainText, timestamp, timestamp);
  }
  finally {
    database.close();
  }
}

module.exports = {
  initializeLocalDevice,
  getOrCreateDocumentSigningKey,
  signDocumentHash,
  getCachedDecryptedMessage,
  saveCachedDecryptedMessage,
};
