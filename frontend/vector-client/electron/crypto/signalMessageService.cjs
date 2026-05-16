const crypto = require('node:crypto');
const encryptedDatabase = require('./encryptedDatabase.cjs');
const secureStorageService = require('./secureStorageService.cjs');
const localCryptoRepository = require('./localCryptoRepository.cjs');
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

  try {
    return decryptLocalPlainTextWithKey(accountId, deviceId, encryptedPayload, currentLocalMessageKey);
  }
  catch (exception) {
    const restoredLocalMessageKeyBase64 = localCryptoRepository.getRestoredLocalMessageKey(accountId, deviceId);

    if (!restoredLocalMessageKeyBase64) {
      throw exception;
    }

    return decryptLocalPlainTextWithKey(
      accountId,
      deviceId,
      encryptedPayload,
      Buffer.from(restoredLocalMessageKeyBase64, 'base64')
    );
  }
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

module.exports = {
  encryptMessage,
  encryptLocalMessage,
  decryptMessage,
};
