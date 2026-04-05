const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('authApi', {
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  ping: () => ipcRenderer.invoke('auth:ping'),
});
