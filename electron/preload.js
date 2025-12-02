const { contextBridge } = require('electron'); // Secure bridge between renderer and main process
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
});

