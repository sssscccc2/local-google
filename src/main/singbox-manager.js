const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { DATA_DIR, SINGBOX_PATH } = require('./paths');

const activeProcesses = new Map();

class SingBoxManager {
  static async start(profileId, node) {
    await SingBoxManager.stop(profileId);

    if (!fs.existsSync(SINGBOX_PATH)) {
      throw new Error('sing-box.exe 未找到，请先运行 npm run download-singbox');
    }

    const localPort = await SingBoxManager._findFreePort();
    const config = SingBoxManager._buildConfig(node, localPort);
    const configDir = path.join(DATA_DIR, 'singbox-configs');
    fs.mkdirSync(configDir, { recursive: true });

    const configPath = path.join(configDir, `${profileId}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return new Promise((resolve, reject) => {
      const child = spawn(SINGBOX_PATH, ['run', '-c', configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let started = false;
      let stderr = '';

      const onData = (data) => {
        const text = data.toString();
        console.log(`[sing-box:${profileId}] ${text.trim()}`);
        if (!started && (text.includes('started') || text.includes('inbound'))) {
          started = true;
          activeProcesses.set(profileId, { process: child, port: localPort, configPath });
          resolve(localPort);
        }
      };

      child.stdout.on('data', onData);
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        onData(data);
      });

      child.on('error', (err) => {
        if (!started) reject(err);
      });

      child.on('exit', (code) => {
        activeProcesses.delete(profileId);
        if (!started) {
          reject(new Error(`sing-box 退出 (code ${code}): ${stderr.slice(0, 200)}`));
        }
      });

      setTimeout(() => {
        if (!started && child.exitCode === null) {
          started = true;
          activeProcesses.set(profileId, { process: child, port: localPort, configPath });
          resolve(localPort);
        }
      }, 3000);
    });
  }

  static async stop(profileId) {
    const entry = activeProcesses.get(profileId);
    if (!entry) return;

    try {
      entry.process.kill();
    } catch (_) {}

    activeProcesses.delete(profileId);

    try {
      if (entry.configPath && fs.existsSync(entry.configPath)) {
        fs.unlinkSync(entry.configPath);
      }
    } catch (_) {}
  }

  static async stopAll() {
    for (const [id] of activeProcesses) {
      await SingBoxManager.stop(id);
    }
  }

  static getPort(profileId) {
    const entry = activeProcesses.get(profileId);
    return entry ? entry.port : null;
  }

  static isRunning(profileId) {
    const entry = activeProcesses.get(profileId);
    return !!(entry && entry.process.exitCode === null);
  }

  static _buildConfig(node, localPort) {
    const config = {
      log: { level: 'info', timestamp: true },
      inbounds: [
        {
          type: 'socks',
          tag: 'socks-in',
          listen: '127.0.0.1',
          listen_port: localPort,
        },
      ],
      outbounds: [
        SingBoxManager._buildOutbound(node),
        { type: 'direct', tag: 'direct' },
      ],
    };
    return config;
  }

  static _buildOutbound(node) {
    const base = {
      tag: 'proxy',
      type: node.type,
      server: node.server,
      server_port: node.server_port,
    };

    switch (node.type) {
      case 'vmess':
        Object.assign(base, {
          uuid: node.uuid,
          alter_id: node.alter_id || 0,
          security: node.security || 'auto',
        });
        break;
      case 'vless':
        Object.assign(base, {
          uuid: node.uuid,
          flow: node.flow || '',
        });
        break;
      case 'shadowsocks':
        Object.assign(base, {
          method: node.method,
          password: node.password,
        });
        break;
      case 'trojan':
        Object.assign(base, {
          password: node.password,
        });
        break;
      case 'socks':
        if (node.username) {
          base.username = node.username;
          base.password = node.password || '';
        }
        break;
      case 'http':
        if (node.username) {
          base.username = node.username;
          base.password = node.password || '';
        }
        break;
    }

    if (node.tls && node.tls.enabled) {
      base.tls = {
        enabled: true,
        server_name: node.tls.server_name || node.server,
        insecure: false,
      };
      if (node.tls.reality && node.tls.reality.enabled) {
        base.tls.reality = {
          enabled: true,
          public_key: node.tls.reality.public_key,
          short_id: node.tls.reality.short_id,
        };
      }
    }

    if (node.transport) {
      base.transport = { ...node.transport };
    }

    return base;
  }

  static _findFreePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.listen(0, '127.0.0.1', () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
      srv.on('error', reject);
    });
  }
}

module.exports = { SingBoxManager };
