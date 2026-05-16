const { ipcMain } = require('electron');
const encryptedDatabase = require('./encryptedDatabase.cjs');
const secureStorageService = require('./secureStorageService.cjs');
const localCryptoRepository = require('./localCryptoRepository.cjs');
const signalKeyService = require('./signalKeyService.cjs');
const signalMessageService = require('./signalMessageService.cjs');
const keyBackupService = require('./keyBackupService.cjs');

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



  ipcMain.handle('vectorCrypto:getOrCreateDocumentSigningKey', async (_event, request) => {
    return localCryptoRepository.getOrCreateDocumentSigningKey(request?.accountId, request?.deviceId);
  });

  ipcMain.handle('vectorCrypto:signDocumentHash', async (_event, request) => {
    return localCryptoRepository.signDocumentHash(request?.accountId, request?.deviceId, request?.documentHashBase64);
  });

  ipcMain.handle('vectorCrypto:encryptMessage', async (_event, request) => {
    return signalMessageService.encryptMessage(request);
  });

  ipcMain.handle('vectorCrypto:encryptLocalMessage', async (_event, request) => {
    return signalMessageService.encryptLocalMessage(request);
  });

  ipcMain.handle('vectorCrypto:encryptGroupMessage', async (_event, request) => {
    return signalMessageService.encryptGroupMessage(request);
  });

  ipcMain.handle('vectorCrypto:importGroupKey', async (_event, request) => {
    return signalMessageService.importGroupKey(request);
  });

  ipcMain.handle('vectorCrypto:decryptGroupMessage', async (_event, request) => {
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

    const decryptResponse = await signalMessageService.decryptGroupMessage(request);

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

  ipcMain.handle('vectorCrypto:exportEncryptedKeyBackup', async (_event, request) => {
    return keyBackupService.exportEncryptedKeyBackup(request);
  });

  ipcMain.handle('vectorCrypto:importEncryptedKeyBackup', async (_event, request) => {
    return keyBackupService.importEncryptedKeyBackup(request);
  });

  ipcMain.handle('vectorCrypto:getRestoredDeviceIds', async (_event, request) => {
    return keyBackupService.getRestoredDeviceIds(request?.accountId);
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
