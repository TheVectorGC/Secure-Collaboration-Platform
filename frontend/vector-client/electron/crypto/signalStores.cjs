function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function fromBase64(value) {
  return Buffer.from(value, 'base64');
}

function nowIso() {
  return new Date().toISOString();
}

function addressKey(protocolAddress) {
  return protocolAddress.toString();
}

async function loadSignalClient() {
  return import('@signalapp/libsignal-client');
}

class SqliteSessionStoreBase {
  configure(database, accountId, deviceId, SignalClient) {
    this.database = database;
    this.accountId = accountId;
    this.deviceId = deviceId;
    this.SignalClient = SignalClient;
  }

  async saveSession(protocolAddress, sessionRecord) {
    const timestamp = nowIso();

    this.database
      .prepare(`
        INSERT INTO signal_sessions(account_id, device_id, remote_address, session_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, device_id, remote_address)
        DO UPDATE SET session_data = excluded.session_data, updated_at = excluded.updated_at
      `)
      .run(
        this.accountId,
        this.deviceId,
        addressKey(protocolAddress),
        toBase64(sessionRecord.serialize()),
        timestamp,
        timestamp
      );
  }

  async getSession(protocolAddress) {
    const row = this.database
      .prepare('SELECT session_data FROM signal_sessions WHERE account_id = ? AND device_id = ? AND remote_address = ?')
      .get(this.accountId, this.deviceId, addressKey(protocolAddress));

    if (!row) {
      return null;
    }

    return this.SignalClient.SessionRecord.deserialize(fromBase64(row.session_data));
  }

  async getExistingSessions(protocolAddresses) {
    const sessionRecords = [];

    for (const protocolAddress of protocolAddresses) {
      const sessionRecord = await this.getSession(protocolAddress);

      if (sessionRecord) {
        sessionRecords.push(sessionRecord);
      }
    }

    return sessionRecords;
  }
}

class SqliteIdentityKeyStoreBase {
  configure(database, accountId, deviceId, SignalClient) {
    this.database = database;
    this.accountId = accountId;
    this.deviceId = deviceId;
    this.SignalClient = SignalClient;
  }

  async getIdentityKey() {
    const row = this.database
      .prepare('SELECT private_key FROM identity_keys WHERE account_id = ? AND device_id = ?')
      .get(this.accountId, this.deviceId);

    if (!row) {
      throw new Error('Local identity key is not available.');
    }

    return this.SignalClient.PrivateKey.deserialize(fromBase64(row.private_key));
  }

  async getLocalRegistrationId() {
    const row = this.database
      .prepare('SELECT registration_id FROM local_devices WHERE account_id = ? AND device_id = ?')
      .get(this.accountId, this.deviceId);

    if (!row || row.registration_id == null) {
      throw new Error('Local registration ID is not available.');
    }

    return row.registration_id;
  }

  async saveIdentity(protocolAddress, publicKey) {
    const remoteAddress = addressKey(protocolAddress);
    const serializedPublicKey = toBase64(publicKey.serialize());
    const timestamp = nowIso();
    const existingIdentity = await this.getIdentity(protocolAddress);

    this.database
      .prepare(`
        INSERT INTO trusted_identities(account_id, device_id, remote_address, public_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, device_id, remote_address)
        DO UPDATE SET public_key = excluded.public_key, updated_at = excluded.updated_at
      `)
      .run(this.accountId, this.deviceId, remoteAddress, serializedPublicKey, timestamp, timestamp);

    if (existingIdentity && Buffer.compare(existingIdentity.serialize(), publicKey.serialize()) !== 0) {
      return this.SignalClient.IdentityChange.ReplacedExisting;
    }

    return this.SignalClient.IdentityChange.NewOrUnchanged;
  }

  async isTrustedIdentity(protocolAddress, publicKey) {
    const existingIdentity = await this.getIdentity(protocolAddress);

    if (!existingIdentity) {
      return true;
    }

    return Buffer.compare(existingIdentity.serialize(), publicKey.serialize()) === 0;
  }

  async getIdentity(protocolAddress) {
    const row = this.database
      .prepare('SELECT public_key FROM trusted_identities WHERE account_id = ? AND device_id = ? AND remote_address = ?')
      .get(this.accountId, this.deviceId, addressKey(protocolAddress));

    if (!row) {
      return null;
    }

    return this.SignalClient.PublicKey.deserialize(fromBase64(row.public_key));
  }
}

class SqlitePreKeyStoreBase {
  configure(database, accountId, deviceId, SignalClient) {
    this.database = database;
    this.accountId = accountId;
    this.deviceId = deviceId;
    this.SignalClient = SignalClient;
  }

  async savePreKey(keyId, preKeyRecord) {
    const timestamp = nowIso();

    this.database
      .prepare(`
        INSERT OR REPLACE INTO one_time_prekeys(account_id, device_id, key_id, public_key, private_key, status, created_at, used_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        this.accountId,
        this.deviceId,
        keyId,
        toBase64(preKeyRecord.publicKey().serialize()),
        toBase64(preKeyRecord.privateKey().serialize()),
        'LOCAL',
        timestamp,
        null
      );
  }

  async getPreKey(keyId) {
    const row = this.database
      .prepare('SELECT public_key, private_key FROM one_time_prekeys WHERE account_id = ? AND device_id = ? AND key_id = ?')
      .get(this.accountId, this.deviceId, keyId);

    if (!row) {
      throw new Error(`Local one-time prekey ${keyId} is not available.`);
    }

    return this.SignalClient.PreKeyRecord.new(
      keyId,
      this.SignalClient.PublicKey.deserialize(fromBase64(row.public_key)),
      this.SignalClient.PrivateKey.deserialize(fromBase64(row.private_key))
    );
  }

  async removePreKey(keyId) {
    this.database
      .prepare('UPDATE one_time_prekeys SET status = ?, used_at = ? WHERE account_id = ? AND device_id = ? AND key_id = ?')
      .run('USED', nowIso(), this.accountId, this.deviceId, keyId);
  }
}

class SqliteSignedPreKeyStoreBase {
  configure(database, accountId, deviceId, SignalClient) {
    this.database = database;
    this.accountId = accountId;
    this.deviceId = deviceId;
    this.SignalClient = SignalClient;
  }

  async saveSignedPreKey(keyId, signedPreKeyRecord) {
    const timestamp = nowIso();

    this.database
      .prepare(`
        INSERT OR REPLACE INTO signed_prekeys(account_id, device_id, key_id, public_key, private_key, signature, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        this.accountId,
        this.deviceId,
        keyId,
        toBase64(signedPreKeyRecord.publicKey().serialize()),
        toBase64(signedPreKeyRecord.privateKey().serialize()),
        toBase64(signedPreKeyRecord.signature()),
        timestamp,
        null
      );
  }

  async getSignedPreKey(keyId) {
    const row = this.database
      .prepare('SELECT public_key, private_key, signature, created_at FROM signed_prekeys WHERE account_id = ? AND device_id = ? AND key_id = ?')
      .get(this.accountId, this.deviceId, keyId);

    if (!row) {
      throw new Error(`Local signed prekey ${keyId} is not available.`);
    }

    return this.SignalClient.SignedPreKeyRecord.new(
      keyId,
      Date.parse(row.created_at),
      this.SignalClient.PublicKey.deserialize(fromBase64(row.public_key)),
      this.SignalClient.PrivateKey.deserialize(fromBase64(row.private_key)),
      fromBase64(row.signature)
    );
  }
}

class SqliteKyberPreKeyStoreBase {
  configure(database, accountId, deviceId, SignalClient) {
    this.database = database;
    this.accountId = accountId;
    this.deviceId = deviceId;
    this.SignalClient = SignalClient;
  }

  async saveKyberPreKey(keyId, kyberPreKeyRecord) {
    const timestamp = nowIso();

    this.database
      .prepare(`
        INSERT OR REPLACE INTO kyber_prekeys(account_id, device_id, key_id, public_key, secret_key, signature, record_data, status, created_at, used_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        this.accountId,
        this.deviceId,
        keyId,
        toBase64(kyberPreKeyRecord.publicKey().serialize()),
        toBase64(kyberPreKeyRecord.secretKey().serialize()),
        toBase64(kyberPreKeyRecord.signature()),
        toBase64(kyberPreKeyRecord.serialize()),
        'ACTIVE',
        timestamp,
        null,
        null
      );
  }

  async getKyberPreKey(keyId) {
    const row = this.database
      .prepare('SELECT record_data FROM kyber_prekeys WHERE account_id = ? AND device_id = ? AND key_id = ?')
      .get(this.accountId, this.deviceId, keyId);

    if (!row) {
      throw new Error(`Local Kyber prekey ${keyId} is not available.`);
    }

    return this.SignalClient.KyberPreKeyRecord.deserialize(fromBase64(row.record_data));
  }

  async markKyberPreKeyUsed(keyId) {
    this.database
      .prepare('UPDATE kyber_prekeys SET status = ?, used_at = ? WHERE account_id = ? AND device_id = ? AND key_id = ?')
      .run('USED', nowIso(), this.accountId, this.deviceId, keyId);
  }
}

async function createSignalStores(database, accountId, deviceId) {
  const SignalClient = await loadSignalClient();

  class SqliteSessionStore extends SignalClient.SessionStore {}
  Object.getOwnPropertyNames(SqliteSessionStoreBase.prototype)
    .filter((propertyName) => propertyName !== 'constructor')
    .forEach((propertyName) => {
      SqliteSessionStore.prototype[propertyName] = SqliteSessionStoreBase.prototype[propertyName];
    });

  class SqliteIdentityKeyStore extends SignalClient.IdentityKeyStore {}
  Object.getOwnPropertyNames(SqliteIdentityKeyStoreBase.prototype)
    .filter((propertyName) => propertyName !== 'constructor')
    .forEach((propertyName) => {
      SqliteIdentityKeyStore.prototype[propertyName] = SqliteIdentityKeyStoreBase.prototype[propertyName];
    });

  class SqlitePreKeyStore extends SignalClient.PreKeyStore {}
  Object.getOwnPropertyNames(SqlitePreKeyStoreBase.prototype)
    .filter((propertyName) => propertyName !== 'constructor')
    .forEach((propertyName) => {
      SqlitePreKeyStore.prototype[propertyName] = SqlitePreKeyStoreBase.prototype[propertyName];
    });

  class SqliteSignedPreKeyStore extends SignalClient.SignedPreKeyStore {}
  Object.getOwnPropertyNames(SqliteSignedPreKeyStoreBase.prototype)
    .filter((propertyName) => propertyName !== 'constructor')
    .forEach((propertyName) => {
      SqliteSignedPreKeyStore.prototype[propertyName] = SqliteSignedPreKeyStoreBase.prototype[propertyName];
    });

  class SqliteKyberPreKeyStore extends SignalClient.KyberPreKeyStore {}
  Object.getOwnPropertyNames(SqliteKyberPreKeyStoreBase.prototype)
    .filter((propertyName) => propertyName !== 'constructor')
    .forEach((propertyName) => {
      SqliteKyberPreKeyStore.prototype[propertyName] = SqliteKyberPreKeyStoreBase.prototype[propertyName];
    });

  const sessionStore = new SqliteSessionStore();
  sessionStore.configure(database, accountId, deviceId, SignalClient);

  const identityStore = new SqliteIdentityKeyStore();
  identityStore.configure(database, accountId, deviceId, SignalClient);

  const preKeyStore = new SqlitePreKeyStore();
  preKeyStore.configure(database, accountId, deviceId, SignalClient);

  const signedPreKeyStore = new SqliteSignedPreKeyStore();
  signedPreKeyStore.configure(database, accountId, deviceId, SignalClient);

  const kyberPreKeyStore = new SqliteKyberPreKeyStore();
  kyberPreKeyStore.configure(database, accountId, deviceId, SignalClient);

  return {
    SignalClient,
    sessionStore,
    identityStore,
    preKeyStore,
    signedPreKeyStore,
    kyberPreKeyStore,
  };
}

module.exports = {
  createSignalStores,
  toBase64,
  fromBase64,
};
