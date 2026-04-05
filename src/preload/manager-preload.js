const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listProfiles: () => ipcRenderer.invoke('profile:list'),
  getProfile: (id) => ipcRenderer.invoke('profile:get', id),
  createProfile: (data) => ipcRenderer.invoke('profile:create', data),
  updateProfile: (id, data) => ipcRenderer.invoke('profile:update', id, data),
  deleteProfile: (id) => ipcRenderer.invoke('profile:delete', id),
  launchProfile: (id) => ipcRenderer.invoke('profile:launch', id),
  generateFingerprint: () => ipcRenderer.invoke('fingerprint:generate'),
  getPresets: () => ipcRenderer.invoke('fingerprint:presets'),
  getChromeStatus: () => ipcRenderer.invoke('chrome:status'),

  listNodes: () => ipcRenderer.invoke('node:list'),
  importNodes: (text) => ipcRenderer.invoke('node:import', text),
  removeNode: (id) => ipcRenderer.invoke('node:remove', id),
  clearNodes: () => ipcRenderer.invoke('node:clear'),
});
