const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => process.platform,

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // System
  showItemInFolder: (path) => ipcRenderer.invoke('system:showItemInFolder', path),
  getPath: (name) => ipcRenderer.invoke('system:getPath', name),

  // Events from main process
  onMaximizeChange: (callback) => {
    const handler = (event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximizeChange', handler);
    return () => ipcRenderer.removeListener('window:maximizeChange', handler);
  },

  // Platform-specific APIs
  platform: process.platform,
  isMac: process.platform === 'darwin',
});

// Log that preload script loaded successfully
console.log('[Preload] Electron API exposed to renderer');
