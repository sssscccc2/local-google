const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { ChromeLauncher } = require('./chrome-launcher');
const { ExtensionBuilder } = require('./extension-builder');
const { SingBoxManager } = require('./singbox-manager');
const { DATA_DIR, EXTENSIONS_DIR } = require('./paths');

class WindowManager {
  constructor(profileManager, nodeStore) {
    this.profileManager = profileManager;
    this.nodeStore = nodeStore;
  }

  createManagerWindow() {
    const win = new BrowserWindow({
      width: 1000,
      height: 700,
      title: '指纹浏览器管理',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'manager-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
    this.managerWindow = win;
  }

  async launchProfile(profileId) {
    const profile = this.profileManager.getProfile(profileId);
    if (!profile) throw new Error(`配置 ${profileId} 不存在`);

    const fp = profile.fingerprint;
    const profileDir = path.join(DATA_DIR, 'profiles', profileId);
    const chromeDataDir = path.join(profileDir, 'chrome-data');
    const fpExtDir = path.join(profileDir, 'fp-extension');

    fs.mkdirSync(chromeDataDir, { recursive: true });

    let proxyForChrome = null;

    if (profile.proxyNodeId && this.nodeStore) {
      const node = this.nodeStore.get(profile.proxyNodeId);
      if (node) {
        const localPort = await SingBoxManager.start(profileId, node);
        proxyForChrome = { type: 'socks5', host: '127.0.0.1', port: localPort };
        console.log(`[SingBox] Profile ${profileId} -> socks5://127.0.0.1:${localPort}`);
      }
    }

    ExtensionBuilder.build(fpExtDir, fp, proxyForChrome);

    const extensions = [fpExtDir];
    const extEntries = getAvailableExtensions();
    extensions.push(...extEntries);

    const result = await ChromeLauncher.launch({
      userDataDir: chromeDataDir,
      extensions,
      proxy: proxyForChrome,
      windowSize: fp.screen ? { width: fp.screen.width, height: fp.screen.height } : null,
      lang: fp.navigator ? fp.navigator.language : null,
      startUrl: 'https://www.google.com',
    });

    this.profileManager.markUsed(profileId);

    return {
      success: true,
      profileId,
      pid: result.pid,
      chromePath: result.chromePath,
    };
  }

  getChromeStatus() {
    const chromePath = ChromeLauncher.findChrome();
    return {
      found: !!chromePath,
      path: chromePath,
    };
  }
}

function getAvailableExtensions() {
  const result = [];
  if (!fs.existsSync(EXTENSIONS_DIR)) return result;

  const entries = fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const extPath = path.join(EXTENSIONS_DIR, entry.name);
    if (fs.existsSync(path.join(extPath, 'manifest.json'))) {
      result.push(extPath);
    }
  }
  return result;
}

module.exports = { WindowManager };
