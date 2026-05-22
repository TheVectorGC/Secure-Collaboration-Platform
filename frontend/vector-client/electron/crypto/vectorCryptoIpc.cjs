const { ipcMain } = require('electron');
const encryptedDatabase = require('./encryptedDatabase.cjs');
const secureStorageService = require('./secureStorageService.cjs');
const localCryptoRepository = require('./localCryptoRepository.cjs');
const signalKeyService = require('./signalKeyService.cjs');
const signalMessageService = require('./signalMessageService.cjs');
const accountBackupService = require('./accountBackupService.cjs');
const deviceEnvironmentService = require('./deviceEnvironmentService.cjs');

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

  ipcMain.handle('vectorCrypto:getDeviceEnvironment', async () => {
    return deviceEnvironmentService.getDeviceEnvironment();
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


  ipcMain.handle('vectorCrypto:encryptContentWithNewKey', async (_event, request) => {
    return signalMessageService.encryptContentWithNewKey(request);
  });

  ipcMain.handle('vectorCrypto:decryptContentWithKey', async (_event, request) => {
    return signalMessageService.decryptContentWithKey(request);
  });

  ipcMain.handle('vectorCrypto:getOrCreateGroupEpochKey', async (_event, request) => {
    return signalMessageService.getOrCreateGroupEpochKey(request);
  });

  ipcMain.handle('vectorCrypto:importGroupKeyFromBackupEnvelope', async (_event, request) => {
    return signalMessageService.importGroupKeyFromBackupEnvelope(request);
  });

  ipcMain.handle('vectorCrypto:encryptGroupMessageV2', async (_event, request) => {
    return signalMessageService.encryptGroupMessageV2(request);
  });

  ipcMain.handle('vectorCrypto:decryptGroupMessageV2', async (_event, request) => {
    return signalMessageService.decryptGroupMessageV2(request);
  });

  ipcMain.handle('vectorCrypto:encryptMessage', async (_event, request) => {
    return signalMessageService.encryptMessage(request);
  });

  ipcMain.handle('vectorCrypto:encryptLocalMessage', async (_event, request) => {
    return signalMessageService.encryptLocalMessage(request);
  });

  ipcMain.handle('vectorCrypto:exportGroupKeyPackagesForChat', async (_event, request) => {
    return signalMessageService.exportGroupKeyPackagesForChat(request);
  });

  ipcMain.handle('vectorCrypto:decryptMessage', async (_event, request) => {
    try {
      const decryptResponse = await signalMessageService.decryptMessage(request);

      return {
        ...decryptResponse,
        fromCache: false,
      };
    }
    catch (error) {
      if (request?.allowFailure) {
        return {
          plainText: null,
          fromCache: false,
          failed: true,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }

      throw error;
    }
  });


  ipcMain.handle('vectorCrypto:setAccountBackupPassword', async (_event, request) => {
    return accountBackupService.setAccountBackupPassword(request);
  });

  ipcMain.handle('vectorCrypto:clearAccountBackupPassword', async (_event, request) => {
    return accountBackupService.clearAccountBackupPassword(request);
  });

  ipcMain.handle('vectorCrypto:hasAccountBackupPassword', async (_event, request) => {
    return accountBackupService.hasAccountBackupPassword(request?.accountId);
  });


  ipcMain.handle('vectorCrypto:createAccountBackupProfile', async (_event, request) => {
    return accountBackupService.createAccountBackupProfile(request);
  });

  ipcMain.handle('vectorCrypto:unlockAccountBackupProfile', async (_event, request) => {
    return accountBackupService.unlockAccountBackupProfile(request);
  });

  ipcMain.handle('vectorCrypto:encryptAccountKeyEnvelope', async (_event, request) => {
    return accountBackupService.encryptAccountKeyEnvelope(request);
  });

  ipcMain.handle('vectorCrypto:decryptAccountKeyEnvelope', async (_event, request) => {
    return accountBackupService.decryptAccountKeyEnvelope(request);
  });

  ipcMain.handle('vectorCrypto:clearAccountLocalVault', async (_event, request) => {
    localCryptoRepository.clearAccountCryptoState(request?.accountId);

    return {
      cleared: true,
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
