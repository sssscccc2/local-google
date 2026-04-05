const { app, ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { WindowManager } = require('./window-manager');
const { ProfileManager } = require('../profiles/profile-manager');
const { FingerprintGenerator } = require('../fingerprint/generator');
const { NodeStore } = require('./node-store');
const { ProxyUrlParser } = require('./proxy-url-parser');
const { SingBoxManager } = require('./singbox-manager');
const { AuthClient } = require('./auth-client');

let windowManager;
let profileManager;
let nodeStore;
let loginWindow;

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: false,
    frame: false,
    title: '登录 - 指纹浏览器',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'login-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  loginWindow.loadFile(path.join(__dirname, '..', 'ui', 'login.html'));
}

function startMainApp() {
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
}

app.whenReady().then(async () => {
  ipcMain.handle('auth:ping', () => AuthClient.ping());
  ipcMain.handle('auth:register', (_e, username, password) => AuthClient.register(username, password));
  ipcMain.handle('auth:login', async (_e, username, password) => {
    const result = await AuthClient.login(username, password);
    if (result.success) {
      if (loginWindow) {
        loginWindow.close();
        loginWindow = null;
      }
      startMainApp();
    }
    return result;
  });

  const isValid = await AuthClient.verify();
  if (isValid) {
    startMainApp();
  } else {
    createLoginWindow();
  }
});

app.on('window-all-closed', () => {
  SingBoxManager.stopAll();
  if (process.platform !== 'darwin') app.quit();
});
