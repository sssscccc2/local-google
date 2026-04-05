import paramiko
import sys

HOST = '146.190.45.66'
USER = 'root'
PASS = 'sunchao250'

SERVER_CODE = r'''
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const DATA_DIR = '/opt/fp-browser-auth';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const PORT = 3000;

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    const defaultHash = crypto.createHash('sha256').update('admin123').digest('hex');
    fs.writeFileSync(USERS_FILE, JSON.stringify([
      { username: 'admin', password: defaultHash, role: 'admin', enabled: true }
    ], null, 2));
  }
  if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, '[]');
  }
}

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadSessions() {
  try { return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')); } catch { return []; }
}

function saveSessions(sessions) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function json(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function cleanExpired() {
  const sessions = loadSessions();
  const now = Date.now();
  const valid = sessions.filter(s => s.expiresAt > now);
  if (valid.length !== sessions.length) saveSessions(valid);
  return valid;
}

ensureFiles();

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { json(res, 200, {}); return; }

  const url = req.url;

  if (url === '/api/login' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    if (!username || !password) return json(res, 400, { error: 'Missing fields' });

    const users = loadUsers();
    const user = users.find(u => u.username === username && u.enabled !== false);
    if (!user || user.password !== hashPwd(password)) {
      return json(res, 401, { error: 'Invalid credentials' });
    }

    const sessions = cleanExpired();
    const existing = sessions.findIndex(s => s.username === username);
    if (existing >= 0) sessions.splice(existing, 1);

    const token = genToken();
    sessions.push({
      token,
      username,
      role: user.role || 'user',
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    });
    saveSessions(sessions);

    return json(res, 200, { token, username, role: user.role || 'user' });
  }

  if (url === '/api/verify' && req.method === 'POST') {
    const { token } = await parseBody(req);
    if (!token) return json(res, 400, { error: 'Missing token' });

    const sessions = cleanExpired();
    const session = sessions.find(s => s.token === token);
    if (!session) return json(res, 401, { error: 'Invalid token' });

    return json(res, 200, { username: session.username, role: session.role });
  }

  if (url === '/api/ping') {
    return json(res, 200, { status: 'ok', time: Date.now() });
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth server running on port ${PORT}`);
});
'''

SYSTEMD_SERVICE = '''[Unit]
Description=FP Browser Auth Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/fp-browser-auth/server.js
Restart=always
RestartSec=5
WorkingDirectory=/opt/fp-browser-auth

[Install]
WantedBy=multi-user.target
'''

def run(ssh, cmd, check=True):
    print(f'  > {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    code = stdout.channel.recv_exit_status()
    if out: print(f'    {out}')
    if err and code != 0: print(f'    ERR: {err}')
    if check and code != 0:
        raise Exception(f'Command failed (exit {code}): {cmd}')
    return out, code

def main():
    print(f'Connecting to {HOST}...')
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS, timeout=15)
    print('Connected!')

    out, code = run(ssh, 'node --version', check=False)
    if code != 0:
        print('Installing Node.js...')
        run(ssh, 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash -')
        run(ssh, 'apt-get install -y nodejs')
        run(ssh, 'node --version')

    print('Creating auth server...')
    run(ssh, 'mkdir -p /opt/fp-browser-auth')

    sftp = ssh.open_sftp()
    with sftp.file('/opt/fp-browser-auth/server.js', 'w') as f:
        f.write(SERVER_CODE)
    with sftp.file('/etc/systemd/system/fp-auth.service', 'w') as f:
        f.write(SYSTEMD_SERVICE)
    sftp.close()

    print('Starting service...')
    run(ssh, 'systemctl daemon-reload')
    run(ssh, 'systemctl enable fp-auth')
    run(ssh, 'systemctl restart fp-auth')
    run(ssh, 'sleep 2')
    out, _ = run(ssh, 'systemctl is-active fp-auth')
    print(f'Service status: {out}')

    out, _ = run(ssh, f'curl -s http://127.0.0.1:3000/api/ping')
    print(f'Ping test: {out}')

    ssh.close()
    print('Done! Auth server deployed.')

if __name__ == '__main__':
    main()
