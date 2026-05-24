const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vectorCrypto', {
  getOrCreateClientInstallationId: () => ipcRenderer.invoke('vectorCrypto:getOrCreateClientInstallationId'),
  getDeviceEnvironment: () => ipcRenderer.invoke('vectorCrypto:getDeviceEnvironment'),
  getHealth: () => ipcRenderer.invoke('vectorCrypto:getHealth'),
  initializeLocalVault: (request) => ipcRenderer.invoke('vectorCrypto:initializeLocalVault', request),
  getOrCreateDocumentSigningKey: (request) => ipcRenderer.invoke('vectorCrypto:getOrCreateDocumentSigningKey', request),
  signDocumentHash: (request) => ipcRenderer.invoke('vectorCrypto:signDocumentHash', request),
  encryptContentWithNewKey: (request) => ipcRenderer.invoke('vectorCrypto:encryptContentWithNewKey', request),
  decryptContentWithKey: (request) => ipcRenderer.invoke('vectorCrypto:decryptContentWithKey', request),
  getOrCreateGroupEpochKey: (request) => ipcRenderer.invoke('vectorCrypto:getOrCreateGroupEpochKey', request),
  importGroupKeyFromBackupEnvelope: (request) => ipcRenderer.invoke('vectorCrypto:importGroupKeyFromBackupEnvelope', request),
  encryptGroupMessageV2: (request) => ipcRenderer.invoke('vectorCrypto:encryptGroupMessageV2', request),
  decryptGroupMessageV2: (request) => ipcRenderer.invoke('vectorCrypto:decryptGroupMessageV2', request),
  encryptMessage: (request) => ipcRenderer.invoke('vectorCrypto:encryptMessage', request),
  exportGroupKeyPackagesForChat: (request) => ipcRenderer.invoke('vectorCrypto:exportGroupKeyPackagesForChat', request),
  encryptLocalMessage: (request) => ipcRenderer.invoke('vectorCrypto:encryptLocalMessage', request),
  decryptMessage: (request) => ipcRenderer.invoke('vectorCrypto:decryptMessage', request),
  setAccountBackupPassword: (request) => ipcRenderer.invoke('vectorCrypto:setAccountBackupPassword', request),
  clearAccountBackupPassword: (request) => ipcRenderer.invoke('vectorCrypto:clearAccountBackupPassword', request),
  hasAccountBackupPassword: (request) => ipcRenderer.invoke('vectorCrypto:hasAccountBackupPassword', request),
  hasUnlockedAccountBackupPrivateKey: (request) => ipcRenderer.invoke('vectorCrypto:hasUnlockedAccountBackupPrivateKey', request),
  createAccountBackupProfile: (request) => ipcRenderer.invoke('vectorCrypto:createAccountBackupProfile', request),
  unlockAccountBackupProfile: (request) => ipcRenderer.invoke('vectorCrypto:unlockAccountBackupProfile', request),
  encryptAccountKeyEnvelope: (request) => ipcRenderer.invoke('vectorCrypto:encryptAccountKeyEnvelope', request),
  decryptAccountKeyEnvelope: (request) => ipcRenderer.invoke('vectorCrypto:decryptAccountKeyEnvelope', request),
  clearAccountLocalVault: (request) => ipcRenderer.invoke('vectorCrypto:clearAccountLocalVault', request),
  clearLocalVault: () => ipcRenderer.invoke('vectorCrypto:clearLocalVault'),
});


contextBridge.exposeInMainWorld('vectorFile', {
  saveToDownloads: (request) => ipcRenderer.invoke('vectorFile:saveToDownloads', request),
});


contextBridge.exposeInMainWorld('vectorDiagnostics', {
  log: (entry) => ipcRenderer.send('vectorDiagnostics:log', entry),
});
