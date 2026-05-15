const crypto = require('node:crypto');
const encryptedDatabase = require('./encryptedDatabase.cjs');
const { toBase64 } = require('./signalStores.cjs');

const DEFAULT_ONE_TIME_PREKEY_COUNT = 100;
const SIGNED_PREKEY_ID = 1;
const KYBER_PREKEY_ID = 1;
const ONE_TIME_PREKEY_STATUS_LOCAL = 'LOCAL';

function nowIso() {
  return new Date().toISOString();
}

function randomPositiveKeyId() {
  return crypto.randomInt(1, 0x7fffffff);
}

async function loadSignalClient() {
  return import('@signalapp/libsignal-client');
}

function getExistingPublicBundle(database, accountId, deviceId) {
  const identityKey = database
    .prepare('SELECT public_key FROM identity_keys WHERE account_id = ? AND device_id = ?')
    .get(accountId, deviceId);

  if (!identityKey) {
    return null;
  }

  const localDevice = database
    .prepare('SELECT registration_id FROM local_devices WHERE account_id = ? AND device_id = ?')
    .get(accountId, deviceId);

  if (!localDevice || localDevice.registration_id == null) {
    return null;
  }

  const signedPreKey = database
    .prepare('SELECT key_id, public_key, signature FROM signed_prekeys WHERE account_id = ? AND device_id = ? ORDER BY key_id DESC LIMIT 1')
    .get(accountId, deviceId);

  const kyberPreKey = database
    .prepare('SELECT key_id, public_key, signature FROM kyber_prekeys WHERE account_id = ? AND device_id = ? AND status = ? ORDER BY key_id DESC LIMIT 1')
    .get(accountId, deviceId, 'ACTIVE');

  const oneTimePreKeys = database
    .prepare('SELECT key_id, public_key FROM one_time_prekeys WHERE account_id = ? AND device_id = ? AND status = ? ORDER BY key_id ASC')
    .all(accountId, deviceId, ONE_TIME_PREKEY_STATUS_LOCAL);

  if (!signedPreKey || !kyberPreKey || oneTimePreKeys.length === 0) {
    return null;
  }

  return {
    registrationId: localDevice.registration_id,
    identityKey: {
      publicKey: identityKey.public_key,
    },
    signedPreKey: {
      keyId: signedPreKey.key_id,
      publicKey: signedPreKey.public_key,
      signature: signedPreKey.signature,
      expiresAt: null,
    },
    kyberPreKey: {
      keyId: kyberPreKey.key_id,
      publicKey: kyberPreKey.public_key,
      signature: kyberPreKey.signature,
      expiresAt: null,
    },
    oneTimePreKeys: oneTimePreKeys.map((oneTimePreKey) => ({
      keyId: oneTimePreKey.key_id,
      publicKey: oneTimePreKey.public_key,
    })),
  };
}

async function ensureDeviceSignalKeyBundle(accountId, deviceId, requestedPreKeyCount = DEFAULT_ONE_TIME_PREKEY_COUNT) {
  const database = encryptedDatabase.openDatabase();

  try {
    const existingBundle = getExistingPublicBundle(database, accountId, deviceId);

    if (existingBundle) {
      return {
        generated: false,
        ...existingBundle,
      };
    }

    const SignalClient = await loadSignalClient();
    const createdAt = nowIso();
    const identityPrivateKey = SignalClient.PrivateKey.generate();
    const signedPreKeyPrivateKey = SignalClient.PrivateKey.generate();
    const kyberKeyPair = SignalClient.KEMKeyPair.generate();
    const identityPublicKey = identityPrivateKey.getPublicKey();
    const signedPreKeyPublicKey = signedPreKeyPrivateKey.getPublicKey();
    const kyberPublicKey = kyberKeyPair.getPublicKey();
    const signedPreKeySignature = identityPrivateKey.sign(signedPreKeyPublicKey.serialize());
    const kyberPreKeySignature = identityPrivateKey.sign(kyberPublicKey.serialize());
    const kyberPreKeyRecord = SignalClient.KyberPreKeyRecord.new(
      KYBER_PREKEY_ID,
      Date.now(),
      kyberKeyPair,
      kyberPreKeySignature
    );

    const registrationIdRow = database
      .prepare('SELECT registration_id FROM local_devices WHERE account_id = ? AND device_id = ?')
      .get(accountId, deviceId);

    if (!registrationIdRow) {
      throw new Error('Local crypto device must be initialized before key generation.');
    }

    database.transaction(() => {
      database
        .prepare(`
          INSERT OR REPLACE INTO identity_keys(account_id, device_id, public_key, private_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          accountId,
          deviceId,
          toBase64(identityPublicKey.serialize()),
          toBase64(identityPrivateKey.serialize()),
          createdAt,
          createdAt
        );

      database
        .prepare(`
          INSERT OR REPLACE INTO signed_prekeys(account_id, device_id, key_id, public_key, private_key, signature, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          accountId,
          deviceId,
          SIGNED_PREKEY_ID,
          toBase64(signedPreKeyPublicKey.serialize()),
          toBase64(signedPreKeyPrivateKey.serialize()),
          toBase64(signedPreKeySignature),
          createdAt,
          null
        );

      database
        .prepare(`
          INSERT OR REPLACE INTO kyber_prekeys(account_id, device_id, key_id, public_key, secret_key, signature, record_data, status, created_at, used_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          accountId,
          deviceId,
          KYBER_PREKEY_ID,
          toBase64(kyberPublicKey.serialize()),
          toBase64(kyberKeyPair.getSecretKey().serialize()),
          toBase64(kyberPreKeySignature),
          toBase64(kyberPreKeyRecord.serialize()),
          'ACTIVE',
          createdAt,
          null,
          null
        );

      const insertOneTimePreKeyStatement = database.prepare(`
        INSERT OR REPLACE INTO one_time_prekeys(account_id, device_id, key_id, public_key, private_key, status, created_at, used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const usedKeyIds = new Set([SIGNED_PREKEY_ID, KYBER_PREKEY_ID]);

      for (let index = 0; index < requestedPreKeyCount; index += 1) {
        let keyId = randomPositiveKeyId();

        while (usedKeyIds.has(keyId)) {
          keyId = randomPositiveKeyId();
        }

        usedKeyIds.add(keyId);
        const oneTimePreKeyPrivateKey = SignalClient.PrivateKey.generate();
        const oneTimePreKeyPublicKey = oneTimePreKeyPrivateKey.getPublicKey();

        insertOneTimePreKeyStatement.run(
          accountId,
          deviceId,
          keyId,
          toBase64(oneTimePreKeyPublicKey.serialize()),
          toBase64(oneTimePreKeyPrivateKey.serialize()),
          ONE_TIME_PREKEY_STATUS_LOCAL,
          createdAt,
          null
        );
      }
    })();

    const generatedBundle = getExistingPublicBundle(database, accountId, deviceId);

    if (!generatedBundle) {
      throw new Error('Signal key generation finished but public bundle is not available.');
    }

    return {
      generated: true,
      ...generatedBundle,
    };
  }
  finally {
    database.close();
  }
}

module.exports = {
  ensureDeviceSignalKeyBundle,
};
