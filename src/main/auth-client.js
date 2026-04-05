const http = require('http');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./paths');

const AUTH_SERVER = 'http://146.190.45.66:3000';
const TOKEN_FILE = path.join(DATA_DIR, '.auth-token');

class AuthClient {
  static _request(endpoint, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, AUTH_SERVER);
      const data = JSON.stringify(body);

      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 8000,
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch {
            reject(new Error('Invalid server response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Connection timeout')); });
      req.write(data);
      req.end();
    });
  }

  static async login(username, password) {
    try {
      const res = await AuthClient._request('/api/login', { username, password });
      if (res.status === 200 && res.data.token) {
        AuthClient._saveToken(res.data.token);
        return { success: true, username: res.data.username, role: res.data.role };
      }
      return { success: false, error: res.data.error || '用户名或密码错误' };
    } catch (err) {
      return { success: false, error: '无法连接认证服务器' };
    }
  }

  static async verify() {
    const token = AuthClient._loadToken();
    if (!token) return false;

    try {
      const res = await AuthClient._request('/api/verify', { token });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  static async ping() {
    try {
      const res = await AuthClient._request('/api/ping', {});
      return res.status === 200;
    } catch {
      return false;
    }
  }

  static logout() {
    try {
      if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
    } catch (_) {}
  }

  static _saveToken(token) {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, token, 'utf-8');
  }

  static _loadToken() {
    try {
      if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
    } catch (_) {}
    return null;
  }
}

module.exports = { AuthClient };
