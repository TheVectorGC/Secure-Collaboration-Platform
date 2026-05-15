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

  ipcMain.handle('vectorCrypto:decryptMessage', async (_event, request) => {
    return signalMessageService.decryptMessage(request);
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
