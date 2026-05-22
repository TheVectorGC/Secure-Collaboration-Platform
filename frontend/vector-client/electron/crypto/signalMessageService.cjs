const crypto = require('node:crypto');
const encryptedDatabase = require('./encryptedDatabase.cjs');
const secureStorageService = require('./secureStorageService.cjs');
const { createSignalStores, fromBase64, toBase64 } = require('./signalStores.cjs');

const SIGNAL_DEVICE_ID = 1;

function validateEncryptRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Signal encryption request is required.');
  }

  if (!request.accountId || typeof request.accountId !== 'string') {
    throw new Error('accountId is required.');
  }

  if (!request.deviceId || typeof request.deviceId !== 'string') {
    throw new Error('deviceId is required.');
  }

  if (!request.targetDeviceId || typeof request.targetDeviceId !== 'string') {
    throw new Error('targetDeviceId is required.');
  }

  if (!request.plainText || typeof request.plainText !== 'string') {
    throw new Error('plainText is required.');
  }

  if (!request.preKeyBundle || typeof request.preKeyBundle !== 'object') {
    throw new Error('preKeyBundle is required.');
  }
}

function validateDecryptRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Signal decryption request is required.');
  }

  if (!request.accountId || typeof request.accountId !== 'string') {
    throw new Error('accountId is required.');
  }

  if (!request.deviceId || typeof request.deviceId !== 'string') {
    throw new Error('deviceId is required.');
  }

  if (!request.remoteDeviceId || typeof request.remoteDeviceId !== 'string') {
    throw new Error('remoteDeviceId is required.');
  }

  if (!request.ciphertextType || typeof request.ciphertextType !== 'string') {
    throw new Error('ciphertextType is required.');
  }

  if (!request.encryptedPayload || typeof request.encryptedPayload !== 'string') {
    throw new Error('encryptedPayload is required.');
  }
}

function toAddress(SignalClient, deviceId) {
  return SignalClient.ProtocolAddress.new(deviceId, SIGNAL_DEVICE_ID);
}

function resolveCiphertextType(SignalClient, ciphertextMessage) {
  if (ciphertextMessage.type() === SignalClient.CiphertextMessageType.PreKey) {
    return 'PRE_KEY';
  }

  if (ciphertextMessage.type() === SignalClient.CiphertextMessageType.Whisper) {
    return 'SIGNAL';
  }

  throw new Error(`Unsupported Signal ciphertext type: ${ciphertextMessage.type()}.`);
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

function encryptLocalPlainText(accountId, deviceId, plainText) {
  const key = deriveLocalMessageKey(accountId, deviceId);
  const initializationVector = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, initializationVector);
  const associatedData = buildLocalAssociatedData(accountId, deviceId);

  cipher.setAAD(associatedData);

  const encryptedBytes = Buffer.concat([
    cipher.update(Buffer.from(plainText, 'utf8')),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return toBase64(Buffer.from(JSON.stringify({
    version: 1,
    algorithm: 'AES-256-GCM',
    initializationVector: toBase64(initializationVector),
    authenticationTag: toBase64(authenticationTag),
    ciphertext: toBase64(encryptedBytes),
  }), 'utf8'));
}

function decryptLocalPlainTextWithKey(accountId, deviceId, encryptedPayload, key) {
  const serializedEnvelope = fromBase64(encryptedPayload).toString('utf8');
  const envelope = JSON.parse(serializedEnvelope);

  if (envelope.version !== 1 || envelope.algorithm !== 'AES-256-GCM') {
    throw new Error('Unsupported local message encryption envelope.');
  }

  const initializationVector = fromBase64(envelope.initializationVector);
  const authenticationTag = fromBase64(envelope.authenticationTag);
  const ciphertext = fromBase64(envelope.ciphertext);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, initializationVector);

  decipher.setAAD(buildLocalAssociatedData(accountId, deviceId));
  decipher.setAuthTag(authenticationTag);

  const plainTextBytes = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plainTextBytes.toString('utf8');
}

function decryptLocalPlainText(accountId, deviceId, encryptedPayload) {
  const currentLocalMessageKey = deriveLocalMessageKey(accountId, deviceId);
  return decryptLocalPlainTextWithKey(accountId, deviceId, encryptedPayload, currentLocalMessageKey);
}

async function encryptLocalMessage(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Local encryption request is required.');
  }

  if (!request.accountId || typeof request.accountId !== 'string') {
    throw new Error('accountId is required.');
  }

  if (!request.deviceId || typeof request.deviceId !== 'string') {
    throw new Error('deviceId is required.');
  }

  if (!request.plainText || typeof request.plainText !== 'string') {
    throw new Error('plainText is required.');
  }

  return {
    ciphertextType: 'LOCAL',
    encryptedPayload: encryptLocalPlainText(request.accountId, request.deviceId, request.plainText),
  };
}

function buildPreKeyBundle(SignalClient, preKeyBundle) {
  if (typeof preKeyBundle.registrationId !== 'number') {
    throw new Error('PreKey bundle registrationId is required.');
  }

  if (!preKeyBundle.identityKey?.publicKey) {
    throw new Error('PreKey bundle identity key is required.');
  }

  if (!preKeyBundle.signedPreKey?.publicKey || !preKeyBundle.signedPreKey?.signature) {
    throw new Error('PreKey bundle signed prekey is required.');
  }

  if (!preKeyBundle.kyberPreKey?.publicKey || !preKeyBundle.kyberPreKey?.signature) {
    throw new Error('PreKey bundle Kyber prekey is required.');
  }

  const oneTimePreKey = preKeyBundle.oneTimePreKey ?? null;
  const oneTimePreKeyId = oneTimePreKey?.keyId ?? null;
  const oneTimePreKeyPublic = oneTimePreKey?.publicKey
    ? SignalClient.PublicKey.deserialize(fromBase64(oneTimePreKey.publicKey))
    : null;

  return SignalClient.PreKeyBundle.new(
    preKeyBundle.registrationId,
    SIGNAL_DEVICE_ID,
    oneTimePreKeyId,
    oneTimePreKeyPublic,
    preKeyBundle.signedPreKey.keyId,
    SignalClient.PublicKey.deserialize(fromBase64(preKeyBundle.signedPreKey.publicKey)),
    fromBase64(preKeyBundle.signedPreKey.signature),
    SignalClient.PublicKey.deserialize(fromBase64(preKeyBundle.identityKey.publicKey)),
    preKeyBundle.kyberPreKey.keyId,
    SignalClient.KEMPublicKey.deserialize(fromBase64(preKeyBundle.kyberPreKey.publicKey)),
    fromBase64(preKeyBundle.kyberPreKey.signature)
  );
}

async function ensureSessionForTargetDevice(database, stores, targetDeviceId, preKeyBundle) {
  const protocolAddress = toAddress(stores.SignalClient, targetDeviceId);
  const existingSession = await stores.sessionStore.getSession(protocolAddress);

  if (existingSession && existingSession.hasCurrentState(new Date())) {
    return protocolAddress;
  }

  const signalPreKeyBundle = buildPreKeyBundle(stores.SignalClient, preKeyBundle);

  await stores.SignalClient.processPreKeyBundle(
    signalPreKeyBundle,
    protocolAddress,
    stores.sessionStore,
    stores.identityStore,
    stores.SignalClient.UsePQRatchet.No,
    new Date()
  );

  return protocolAddress;
}

async function encryptMessage(request) {
  validateEncryptRequest(request);

  const database = encryptedDatabase.openDatabase();

  try {
    const stores = await createSignalStores(database, request.accountId, request.deviceId);
    const protocolAddress = await ensureSessionForTargetDevice(
      database,
      stores,
      request.targetDeviceId,
      request.preKeyBundle
    );

    const ciphertextMessage = await stores.SignalClient.signalEncrypt(
      Buffer.from(request.plainText, 'utf8'),
      protocolAddress,
      stores.sessionStore,
      stores.identityStore,
      new Date()
    );

    return {
      ciphertextType: resolveCiphertextType(stores.SignalClient, ciphertextMessage),
      encryptedPayload: toBase64(ciphertextMessage.serialize()),
    };
  }
  finally {
    database.close();
  }
}

async function decryptMessage(request) {
  validateDecryptRequest(request);

  const database = encryptedDatabase.openDatabase();

  try {
    const stores = await createSignalStores(database, request.accountId, request.deviceId);
    const protocolAddress = toAddress(stores.SignalClient, request.remoteDeviceId);
    const serializedCiphertext = fromBase64(request.encryptedPayload);
    let plainTextBuffer;

    if (request.ciphertextType === 'LOCAL') {
      return {
        plainText: decryptLocalPlainText(request.accountId, request.deviceId, request.encryptedPayload),
      };
    }

    if (request.ciphertextType === 'PRE_KEY') {
      const preKeySignalMessage = stores.SignalClient.PreKeySignalMessage.deserialize(serializedCiphertext);
      plainTextBuffer = await stores.SignalClient.signalDecryptPreKey(
        preKeySignalMessage,
        protocolAddress,
        stores.sessionStore,
        stores.identityStore,
        stores.preKeyStore,
        stores.signedPreKeyStore,
        stores.kyberPreKeyStore,
        stores.SignalClient.UsePQRatchet.No
      );
    }
    else if (request.ciphertextType === 'SIGNAL') {
      const signalMessage = stores.SignalClient.SignalMessage.deserialize(serializedCiphertext);
      plainTextBuffer = await stores.SignalClient.signalDecrypt(
        signalMessage,
        protocolAddress,
        stores.sessionStore,
        stores.identityStore
      );
    }
    else {
      throw new Error(`Unsupported ciphertext type: ${request.ciphertextType}.`);
    }

    return {
      plainText: plainTextBuffer.toString('utf8'),
    };
  }
  finally {
    database.close();
  }
}

function normalizeGroupKeySenderDeviceId(senderDeviceId) {
  if (!senderDeviceId || typeof senderDeviceId !== 'string') {
    return 'account-backup';
  }

  return senderDeviceId;
}

function saveGroupKey(database, accountId, chatId, epoch, senderDeviceId, keyBase64) {
  const normalizedEpoch = Number(epoch ?? 1);
  const timestamp = new Date().toISOString();

  database
    .prepare(`
      INSERT INTO group_keys(account_id, chat_id, epoch, sender_device_id, key_base64, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, chat_id, epoch, sender_device_id) DO UPDATE SET
        key_base64 = excluded.key_base64,
        updated_at = excluded.updated_at
    `)
    .run(accountId, chatId, normalizedEpoch, normalizeGroupKeySenderDeviceId(senderDeviceId), keyBase64, timestamp, timestamp);
}

function getExistingGroupKey(database, accountId, chatId, epoch, preferredSenderDeviceId) {
  const normalizedEpoch = Number(epoch ?? 1);
  const existingKey = database
    .prepare(`
      SELECT key_base64
      FROM group_keys
      WHERE account_id = ? AND chat_id = ? AND epoch = ?
      ORDER BY CASE WHEN sender_device_id = ? THEN 0 ELSE 1 END, updated_at DESC
      LIMIT 1
    `)
    .get(accountId, chatId, normalizedEpoch, normalizeGroupKeySenderDeviceId(preferredSenderDeviceId));

  return existingKey?.key_base64 ? Buffer.from(existingKey.key_base64, 'base64') : null;
}

function getOrCreateGroupKey(database, accountId, chatId, epoch, senderDeviceId) {
  const normalizedEpoch = Number(epoch ?? 1);
  const existingKey = database
    .prepare(`
      SELECT key_base64
      FROM group_keys
      WHERE account_id = ? AND chat_id = ? AND epoch = ?
      ORDER BY CASE WHEN sender_device_id = ? THEN 0 ELSE 1 END, updated_at DESC
      LIMIT 1
    `)
    .get(accountId, chatId, normalizedEpoch, normalizeGroupKeySenderDeviceId(senderDeviceId));

  if (existingKey?.key_base64) {
    return Buffer.from(existingKey.key_base64, 'base64');
  }

  const key = crypto.randomBytes(32);
  saveGroupKey(database, accountId, chatId, normalizedEpoch, senderDeviceId, key.toString('base64'));
  return key;
}

function buildGroupKeyDistributionPackage(accountId, chatId, epoch, senderDeviceId, key) {
  return JSON.stringify({
    type: 'VECTOR_GROUP_KEY',
    version: 1,
    accountId,
    chatId,
    epoch: Number(epoch ?? 1),
    senderDeviceId,
    algorithm: 'AES-256-GCM',
    keyBase64: key.toString('base64'),
    exportedAt: new Date().toISOString(),
  });
}

function validateGroupCryptoRequest(request, requirePlainText) {
  if (!request || typeof request !== 'object') {
    throw new Error('Group crypto request is required.');
  }

  if (!request.accountId || typeof request.accountId !== 'string') {
    throw new Error('accountId is required.');
  }

  if (!request.chatId || typeof request.chatId !== 'string') {
    throw new Error('chatId is required.');
  }

  if (requirePlainText && typeof request.epoch !== 'number') {
    throw new Error('Group key epoch is required.');
  }

  if (requirePlainText && (!request.deviceId || typeof request.deviceId !== 'string')) {
    throw new Error('deviceId is required for group encryption.');
  }

  if (requirePlainText && typeof request.plainText !== 'string') {
    throw new Error('plainText is required.');
  }
}

async function exportGroupKeyPackagesForChat(request) {
  validateGroupCryptoRequest(request, false);

  const database = encryptedDatabase.openDatabase();

  try {
    const rows = database
      .prepare(`
        SELECT epoch, sender_device_id, key_base64
        FROM group_keys
        WHERE account_id = ? AND chat_id = ?
        ORDER BY epoch ASC, updated_at DESC
      `)
      .all(request.accountId, request.chatId);

    const exportedEpochs = new Set();
    const packages = [];

    rows.forEach((row) => {
      const epoch = Number(row.epoch);

      if (exportedEpochs.has(epoch)) {
        return;
      }

      exportedEpochs.add(epoch);
      packages.push(buildGroupKeyDistributionPackage(
        request.accountId,
        request.chatId,
        epoch,
        row.sender_device_id,
        Buffer.from(row.key_base64, 'base64')
      ));
    });

    return {
      chatId: request.chatId,
      packages,
    };
  }
  finally {
    database.close();
  }
}

function encryptContentWithNewKey(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Content encryption request is required.');
  }

  if (typeof request.plainText !== 'string') {
    throw new Error('plainText is required.');
  }

  const messageKey = crypto.randomBytes(32);
  const initializationVector = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', messageKey, initializationVector);
  const encryptedBytes = Buffer.concat([
    cipher.update(Buffer.from(request.plainText, 'utf8')),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return {
    algorithm: 'AES-256-GCM',
    keyBase64: toBase64(messageKey),
    encryptedPayload: toBase64(encryptedBytes),
    initializationVectorBase64: toBase64(initializationVector),
    authenticationTagBase64: toBase64(authenticationTag),
  };
}

function decryptContentWithKey(request) {
  if (!request?.keyBase64 || !request?.encryptedPayload || !request?.initializationVectorBase64 || !request?.authenticationTagBase64) {
    throw new Error('Content key, payload, initialization vector and authentication tag are required.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', fromBase64(request.keyBase64), fromBase64(request.initializationVectorBase64));
  decipher.setAuthTag(fromBase64(request.authenticationTagBase64));
  const plainTextBytes = Buffer.concat([
    decipher.update(fromBase64(request.encryptedPayload)),
    decipher.final(),
  ]);

  return {
    plainText: plainTextBytes.toString('utf8'),
  };
}

function deriveGroupMessageKey(groupKey, chatId, epoch, messageId) {
  return crypto
    .createHmac('sha256', groupKey)
    .update(`vector-group-message-key:${chatId}:${Number(epoch ?? 1)}:${messageId}`)
    .digest();
}

function getOrCreateGroupEpochKey(request) {
  validateGroupCryptoRequest(request, false);

  if (!request.deviceId || typeof request.deviceId !== 'string') {
    throw new Error('deviceId is required for group epoch key creation.');
  }

  const database = encryptedDatabase.openDatabase();

  try {
    const key = getOrCreateGroupKey(database, request.accountId, request.chatId, request.epoch, request.deviceId);
    return {
      chatId: request.chatId,
      epoch: Number(request.epoch ?? 1),
      senderDeviceId: request.deviceId,
      groupEpochKeyBase64: toBase64(key),
      groupKeyPackagePlainText: buildGroupKeyDistributionPackage(request.accountId, request.chatId, request.epoch, request.deviceId, key),
    };
  }
  finally {
    database.close();
  }
}

function importGroupKeyFromBackupEnvelope(request) {
  validateGroupCryptoRequest(request, false);

  if (!request.groupEpochKeyBase64 || typeof request.groupEpochKeyBase64 !== 'string') {
    throw new Error('groupEpochKeyBase64 is required.');
  }

  if (!request.senderDeviceId || typeof request.senderDeviceId !== 'string') {
    throw new Error('senderDeviceId is required.');
  }

  const key = Buffer.from(request.groupEpochKeyBase64, 'base64');

  if (key.length !== 32) {
    throw new Error('Invalid group epoch key length.');
  }

  const database = encryptedDatabase.openDatabase();

  try {
    saveGroupKey(database, request.accountId, request.chatId, Number(request.epoch ?? 1), request.senderDeviceId, request.groupEpochKeyBase64);
    return {
      imported: true,
      senderDeviceId: normalizeGroupKeySenderDeviceId(request.senderDeviceId),
    };
  }
  finally {
    database.close();
  }
}

function encryptGroupMessageV2(request) {
  validateGroupCryptoRequest(request, true);

  if (!request.messageId || typeof request.messageId !== 'string') {
    throw new Error('messageId is required for group content encryption.');
  }

  const database = encryptedDatabase.openDatabase();

  try {
    const groupKey = getExistingGroupKey(database, request.accountId, request.chatId, request.epoch, request.deviceId);

    if (!groupKey) {
      throw new Error('Group epoch key is not available locally. Restore the group epoch envelope before sending.');
    }
    const messageKey = deriveGroupMessageKey(groupKey, request.chatId, request.epoch, request.messageId);
    const initializationVector = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', messageKey, initializationVector);
    const encryptedBytes = Buffer.concat([
      cipher.update(Buffer.from(request.plainText, 'utf8')),
      cipher.final(),
    ]);
    const authenticationTag = cipher.getAuthTag();

    return {
      encryptionType: 'GROUP',
      algorithm: 'AES-256-GCM',
      encryptedPayload: toBase64(encryptedBytes),
      initializationVectorBase64: toBase64(initializationVector),
      authenticationTagBase64: toBase64(authenticationTag),
      groupEpochKeyBase64: toBase64(groupKey),
      groupKeyPackagePlainText: buildGroupKeyDistributionPackage(request.accountId, request.chatId, request.epoch, request.deviceId, groupKey),
    };
  }
  finally {
    database.close();
  }
}

function decryptGroupMessageV2(request) {
  validateGroupCryptoRequest(request, false);

  if (!request.messageId || !request.encryptedPayload || !request.initializationVectorBase64 || !request.authenticationTagBase64) {
    throw new Error('messageId, encryptedPayload, initializationVectorBase64 and authenticationTagBase64 are required.');
  }

  const database = encryptedDatabase.openDatabase();

  try {
    const rows = database
      .prepare(`
        SELECT key_base64, sender_device_id
        FROM group_keys
        WHERE account_id = ? AND chat_id = ? AND epoch = ?
        ORDER BY updated_at DESC
      `)
      .all(request.accountId, request.chatId, Number(request.epoch ?? 1));

    for (const row of rows) {
      try {
        const groupKey = Buffer.from(row.key_base64, 'base64');
        const messageKey = deriveGroupMessageKey(groupKey, request.chatId, request.epoch, request.messageId);
        const decipher = crypto.createDecipheriv('aes-256-gcm', messageKey, fromBase64(request.initializationVectorBase64));
        decipher.setAuthTag(fromBase64(request.authenticationTagBase64));
        const plainTextBytes = Buffer.concat([
          decipher.update(fromBase64(request.encryptedPayload)),
          decipher.final(),
        ]);

        return {
          plainText: plainTextBytes.toString('utf8'),
        };
      }
      catch (error) {
      }
    }

    throw new Error(`Group key is not available or did not decrypt this message. chatId=${request.chatId}; epoch=${Number(request.epoch ?? 1)}; localKeyCount=${rows.length}. Restore the group epoch envelope.`);
  }
  finally {
    database.close();
  }
}

module.exports = {
  decryptGroupMessageV2,
  encryptGroupMessageV2,
  importGroupKeyFromBackupEnvelope,
  getOrCreateGroupEpochKey,
  decryptContentWithKey,
  encryptContentWithNewKey,
  encryptMessage,
  encryptLocalMessage,
  decryptMessage,
  exportGroupKeyPackagesForChat,
};
