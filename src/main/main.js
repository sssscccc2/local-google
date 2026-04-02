const { app, ipcMain } = require('electron');
const { WindowManager } = require('./window-manager');
const { ProfileManager } = require('../profiles/profile-manager');
const { FingerprintGenerator } = require('../fingerprint/generator');

let windowManager;
let profileManager;

app.whenReady().then(() => {
  profileManager = new ProfileManager();
  windowManager = new WindowManager(profileManager);

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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
