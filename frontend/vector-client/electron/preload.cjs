const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vectorCrypto', {
  getOrCreateClientInstallationId: () => ipcRenderer.invoke('vectorCrypto:getOrCreateClientInstallationId'),
  getHealth: () => ipcRenderer.invoke('vectorCrypto:getHealth'),
  initializeLocalVault: (request) => ipcRenderer.invoke('vectorCrypto:initializeLocalVault', request),
  encryptMessage: (request) => ipcRenderer.invoke('vectorCrypto:encryptMessage', request),
  encryptLocalMessage: (request) => ipcRenderer.invoke('vectorCrypto:encryptLocalMessage', request),
  decryptMessage: (request) => ipcRenderer.invoke('vectorCrypto:decryptMessage', request),
  clearLocalVault: () => ipcRenderer.invoke('vectorCrypto:clearLocalVault'),
});
