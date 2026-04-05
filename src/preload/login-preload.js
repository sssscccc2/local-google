const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('authApi', {
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  register: (username, password) => ipcRenderer.invoke('auth:register', username, password),
  ping: () => ipcRenderer.invoke('auth:ping'),
});
