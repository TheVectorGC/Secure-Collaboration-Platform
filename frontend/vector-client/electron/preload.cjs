const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vectorCrypto', {
  getOrCreateClientInstallationId: () => ipcRenderer.invoke('vectorCrypto:getOrCreateClientInstallationId'),
  getHealth: () => ipcRenderer.invoke('vectorCrypto:getHealth'),
  initializeLocalVault: (request) => ipcRenderer.invoke('vectorCrypto:initializeLocalVault', request),
  getOrCreateDocumentSigningKey: (request) => ipcRenderer.invoke('vectorCrypto:getOrCreateDocumentSigningKey', request),
  signDocumentHash: (request) => ipcRenderer.invoke('vectorCrypto:signDocumentHash', request),
  encryptMessage: (request) => ipcRenderer.invoke('vectorCrypto:encryptMessage', request),
  encryptGroupMessage: (request) => ipcRenderer.invoke('vectorCrypto:encryptGroupMessage', request),
  decryptGroupMessage: (request) => ipcRenderer.invoke('vectorCrypto:decryptGroupMessage', request),
  importGroupKey: (request) => ipcRenderer.invoke('vectorCrypto:importGroupKey', request),
  exportGroupKeyPackagesForChat: (request) => ipcRenderer.invoke('vectorCrypto:exportGroupKeyPackagesForChat', request),
  encryptLocalMessage: (request) => ipcRenderer.invoke('vectorCrypto:encryptLocalMessage', request),
  decryptMessage: (request) => ipcRenderer.invoke('vectorCrypto:decryptMessage', request),
  exportEncryptedKeyBackup: (request) => ipcRenderer.invoke('vectorCrypto:exportEncryptedKeyBackup', request),
  importEncryptedKeyBackup: (request) => ipcRenderer.invoke('vectorCrypto:importEncryptedKeyBackup', request),
  getRestoredDeviceIds: (request) => ipcRenderer.invoke('vectorCrypto:getRestoredDeviceIds', request),
  clearLocalVault: () => ipcRenderer.invoke('vectorCrypto:clearLocalVault'),
});


contextBridge.exposeInMainWorld('vectorFile', {
  saveToDownloads: (request) => ipcRenderer.invoke('vectorFile:saveToDownloads', request),
});
