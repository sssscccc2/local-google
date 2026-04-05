const { app, ipcMain } = require('electron');
const { WindowManager } = require('./window-manager');
const { ProfileManager } = require('../profiles/profile-manager');
const { FingerprintGenerator } = require('../fingerprint/generator');
const { NodeStore } = require('./node-store');
const { ProxyUrlParser } = require('./proxy-url-parser');
const { SingBoxManager } = require('./singbox-manager');

let windowManager;
let profileManager;
let nodeStore;

app.whenReady().then(() => {
  profileManager = new ProfileManager();
  nodeStore = new NodeStore();
  windowManager = new WindowManager(profileManager, nodeStore);

  windowManager.createManagerWindow();

  ipcMain.handle('profile:list', () => profileManager.listProfiles());
  ipcMain.handle('profile:get', (_e, id) => profileManager.getProfile(id));
  ipcMain.handle('profile:create', (_e, data) => profileManager.createProfile(data));
  ipcMain.handle('profile:update', (_e, id, data) => profileManager.updateProfile(id, data));
  ipcMain.handle('profile:delete', (_e, id) => profileManager.deleteProfile(id));
  ipcMain.handle('profile:launch', (_e, id) => windowManager.launchProfile(id));
  ipcMain.handle('fingerprint:generate', () => FingerprintGenerator.generate());
  ipcMain.handle('fingerprint:presets', () => {
    const { PRESETS } = require('../fingerprint/presets');
    return PRESETS;
  });
  ipcMain.handle('chrome:status', () => windowManager.getChromeStatus());

  ipcMain.handle('node:list', () => nodeStore.list());
  ipcMain.handle('node:getAll', () => nodeStore.getAll());
  ipcMain.handle('node:import', (_e, text) => {
    const parsed = ProxyUrlParser.parseMultiple(text);
    if (parsed.length === 0) throw new Error('未能解析出任何有效节点');
    return nodeStore.addMany(parsed);
  });
  ipcMain.handle('node:remove', (_e, id) => nodeStore.remove(id));
  ipcMain.handle('node:clear', () => nodeStore.clear());
});

app.on('window-all-closed', () => {
  SingBoxManager.stopAll();
  if (process.platform !== 'darwin') app.quit();
});
