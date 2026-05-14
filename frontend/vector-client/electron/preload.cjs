const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vectorCrypto', {
  getHealth: () => ipcRenderer.invoke('vectorCrypto:getHealth'),
  initializeLocalVault: (request) => ipcRenderer.invoke('vectorCrypto:initializeLocalVault', request),
  clearLocalVault: () => ipcRenderer.invoke('vectorCrypto:clearLocalVault'),
});
