const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
];

class ChromeLauncher {
  static findChrome() {
    for (const p of CHROME_PATHS) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  static generateExtensionId(inputStr) {
    const hash = crypto.createHash('sha256').update(inputStr).digest('hex');
    return hash.slice(0, 32).replace(/[0-9a-f]/g, (c) => {
      return String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16));
    });
  }

  static installExtension(chromeDataDir, extSourcePath) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extSourcePath, 'manifest.json'), 'utf-8')
    );
    const extName = manifest.name || 'extension';
    const extVersion = manifest.version || '1.0.0';
    const extId = ChromeLauncher.generateExtensionId(extName);

    const targetDir = path.join(chromeDataDir, 'Default', 'Extensions', extId, extVersion);
    fs.mkdirSync(targetDir, { recursive: true });

    copyDirSync(extSourcePath, targetDir);

    return { extId, extVersion, manifest };
  }

  static writePreferences(chromeDataDir, installedExtensions) {
    const defaultDir = path.join(chromeDataDir, 'Default');
    fs.mkdirSync(defaultDir, { recursive: true });

    const prefsPath = path.join(defaultDir, 'Preferences');
    let prefs = {};
    try {
      if (fs.existsSync(prefsPath)) {
        prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
      }
    } catch (_) {}

    if (!prefs.extensions) prefs.extensions = {};
    if (!prefs.extensions.settings) prefs.extensions.settings = {};
    prefs.extensions.ui = { developer_mode: true };

    const now = String(Date.now());

    for (const ext of installedExtensions) {
      const permissions = ext.manifest.permissions || [];
      const hostPerms = ext.manifest.host_permissions || [];

      prefs.extensions.settings[ext.extId] = {
        active_permissions: {
          api: permissions.filter((p) => !p.includes('/')),
          explicit_host: hostPerms,
          manifest_permissions: [],
        },
        commands: {},
        content_settings: [],
        creation_flags: 1,
        first_install_time: now,
        from_webstore: false,
        granted_permissions: {
          api: permissions.filter((p) => !p.includes('/')),
          explicit_host: hostPerms,
          manifest_permissions: [],
        },
        install_time: now,
        location: 4,
        manifest: ext.manifest,
        path: `${ext.extId}/${ext.extVersion}`,
        state: 1,
        was_installed_by_default: false,
        was_installed_by_oem: false,
      };
    }

    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf-8');
  }

  static async launch(options) {
    const chromePath = ChromeLauncher.findChrome();
    if (!chromePath) {
      throw new Error('未找到本机 Google Chrome，请确认已安装 Chrome 浏览器');
    }

    const {
      userDataDir,
      extensions = [],
      proxy,
      windowSize,
      lang,
      startUrl = 'https://www.google.com',
    } = options;

    const validExtensions = extensions
      .map((ext) => path.resolve(ext))
      .filter((ext) => fs.existsSync(path.join(ext, 'manifest.json')));

    const installed = [];
    for (const extPath of validExtensions) {
      try {
        const info = ChromeLauncher.installExtension(userDataDir, extPath);
        installed.push(info);
        console.log(`[Extension] Installed: ${info.manifest.name} (${info.extId})`);
      } catch (e) {
        console.warn(`[Extension] Failed to install from ${extPath}:`, e.message);
      }
    }

    if (installed.length > 0) {
      ChromeLauncher.writePreferences(userDataDir, installed);
    }

    killChromeByDataDir(userDataDir);
    await sleep(1000);

    const loadPaths = validExtensions.join(',');

    const parts = [
      `"${chromePath}"`,
      `--user-data-dir="${userDataDir}"`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-translate',
      '--enable-extensions',
    ];

    if (proxy && proxy.type && proxy.type !== 'direct') {
      const scheme = proxy.type === 'http' ? 'http' : 'socks5';
      parts.push(`--proxy-server=${scheme}://${proxy.host}:${proxy.port}`);
      parts.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
      parts.push('--disable-features=WebRtcHideLocalIpsWithMdns');
    }

    if (loadPaths) {
      parts.push(`--load-extension="${loadPaths}"`);
    }

    if (windowSize) {
      parts.push(`--window-size=${windowSize.width},${windowSize.height}`);
    }

    if (lang) {
      parts.push(`--lang=${lang}`);
    }

    parts.push(`"${startUrl}"`);

    const cmd = parts.join(' ');
    console.log('[Chrome Launch]', cmd);

    const child = exec(cmd, { windowsHide: false });
    child.unref();

    return {
      pid: child.pid,
      chromePath,
      userDataDir,
    };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killChromeByDataDir(dataDir) {
  try {
    const needle = dataDir.toLowerCase();
    const result = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq \'chrome.exe\' } | Select-Object ProcessId, CommandLine | ConvertTo-Json"',
      { encoding: 'utf-8', timeout: 8000 }
    );
    if (!result || !result.trim()) return;
    let procs = JSON.parse(result.trim());
    if (!Array.isArray(procs)) procs = [procs];

    for (const p of procs) {
      if (!p || !p.CommandLine) continue;
      if (p.CommandLine.toLowerCase().includes(needle)) {
        try { process.kill(p.ProcessId); } catch (_) {}
      }
    }
  } catch (_) {}
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = { ChromeLauncher };
