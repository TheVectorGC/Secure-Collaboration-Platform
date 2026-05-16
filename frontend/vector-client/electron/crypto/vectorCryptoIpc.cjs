const { ipcMain } = require('electron');
const encryptedDatabase = require('./encryptedDatabase.cjs');
const secureStorageService = require('./secureStorageService.cjs');
const localCryptoRepository = require('./localCryptoRepository.cjs');
const signalKeyService = require('./signalKeyService.cjs');
const signalMessageService = require('./signalMessageService.cjs');

function validateInitializeRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Crypto initialization request is required.');
  }

  if (!request.accountId || typeof request.accountId !== 'string') {
    throw new Error('accountId is required.');
  }

  if (!request.deviceId || typeof request.deviceId !== 'string') {
    throw new Error('deviceId is required.');
  }
}

function registerVectorCryptoIpc() {
  ipcMain.handle('vectorCrypto:getOrCreateClientInstallationId', async () => {
    return secureStorageService.getOrCreateClientInstallationId();
  });

  ipcMain.handle('vectorCrypto:getHealth', async () => {
    const storageHealth = secureStorageService.getHealth();

    return {
      available: storageHealth.safeStorageAvailable,
      safeStorageAvailable: storageHealth.safeStorageAvailable,
      cryptoDirectory: storageHealth.cryptoDirectory,
      masterKeyExists: storageHealth.masterKeyExists,
      databasePath: encryptedDatabase.getDatabaseFilePath(),
    };
  });

  ipcMain.handle('vectorCrypto:initializeLocalVault', async (_event, request) => {
    validateInitializeRequest(request);

    const initializedDevice = localCryptoRepository.initializeLocalDevice(
      request.accountId,
      request.deviceId
    );

    const signalKeyBundle = await signalKeyService.ensureDeviceSignalKeyBundle(
      request.accountId,
      request.deviceId,
      request.oneTimePreKeyCount ?? 100
    );

    return {
      ready: true,
      accountId: initializedDevice.accountId,
      deviceId: initializedDevice.deviceId,
      registrationId: initializedDevice.registrationId,
      createdAt: initializedDevice.createdAt,
      alreadyExisted: initializedDevice.alreadyExisted,
      databasePath: encryptedDatabase.getDatabaseFilePath(),
      signalKeyBundle,
    };
  });

  ipcMain.handle('vectorCrypto:encryptMessage', async (_event, request) => {
    return signalMessageService.encryptMessage(request);
  });

  ipcMain.handle('vectorCrypto:encryptLocalMessage', async (_event, request) => {
    return signalMessageService.encryptLocalMessage(request);
  });

  ipcMain.handle('vectorCrypto:ensureDocumentSigningKey', async (_event, request) => {
    validateInitializeRequest(request);
    const signingKey = localCryptoRepository.getOrCreateDocumentSigningKey(request.accountId, request.deviceId);

    return {
      publicKeyBase64: signingKey.publicKeyBase64,
      fingerprint: signingKey.fingerprint,
      createdAt: signingKey.createdAt,
      alreadyExisted: signingKey.alreadyExisted,
    };
  });

  ipcMain.handle('vectorCrypto:signDocumentHash', async (_event, request) => {
    validateInitializeRequest(request);

    if (!request.documentHashBase64 || typeof request.documentHashBase64 !== 'string') {
      throw new Error('documentHashBase64 is required.');
    }

    return localCryptoRepository.signDocumentHash(
      request.accountId,
      request.deviceId,
      request.documentHashBase64
    );
  });

  ipcMain.handle('vectorCrypto:decryptMessage', async (_event, request) => {
    if (request?.messageId) {
      const cachedPlainText = localCryptoRepository.getCachedDecryptedMessage(
        request.accountId,
        request.deviceId,
        request.messageId
      );

      if (cachedPlainText !== null) {
        return {
          plainText: cachedPlainText,
          fromCache: true,
        };
      }
    }

    const decryptResponse = await signalMessageService.decryptMessage(request);

    if (request?.messageId) {
      localCryptoRepository.saveCachedDecryptedMessage(
        request.accountId,
        request.deviceId,
        request.messageId,
        decryptResponse.plainText
      );
    }

    return {
      ...decryptResponse,
      fromCache: false,
    };
  });

  ipcMain.handle('vectorCrypto:clearLocalVault', async () => {
    encryptedDatabase.clearDatabase();
    secureStorageService.clearMasterKey();

    return {
      cleared: true,
    };
  });
}

module.exports = {
  registerVectorCryptoIpc,
};
