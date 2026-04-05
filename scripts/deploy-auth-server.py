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
    fs.writeFileSync(USERS_FILE, JSON.stringify([
      { username: 'sunchao', password: hashPwd('sunchao250'), role: 'admin', enabled: true, createdAt: Date.now() }
    ], null, 2));
  }
  if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, '[]');
}

function loadUsers() { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); }
function saveUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }
function loadSessions() { try { return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')); } catch { return []; } }
function saveSessions(s) { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(s, null, 2)); }
function hashPwd(p) { return crypto.createHash('sha256').update(p).digest('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }

function parseBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({}); } });
  });
}

function json(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function html(res, content) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(content);
}

function cleanExpired() {
  const s = loadSessions();
  const now = Date.now();
  const valid = s.filter(x => x.expiresAt > now);
  if (valid.length !== s.length) saveSessions(valid);
  return valid;
}

function getSessionUser(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  const sessions = cleanExpired();
  return sessions.find(s => s.token === token) || null;
}

ensureFiles();

// Ensure admin exists
const users = loadUsers();
const hasAdmin = users.find(u => u.username === 'sunchao');
if (!hasAdmin) {
  users.push({ username: 'sunchao', password: hashPwd('sunchao250'), role: 'admin', enabled: true, createdAt: Date.now() });
  saveUsers(users);
}

const ADMIN_HTML = `ADMIN_HTML_PLACEHOLDER`;

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { json(res, 200, {}); return; }

  const url = req.url.split('?')[0];

  // --- Public API ---
  if (url === '/api/ping') return json(res, 200, { status: 'ok', time: Date.now() });

  if (url === '/api/login' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    if (!username || !password) return json(res, 400, { error: '请填写用户名和密码' });
    const users = loadUsers();
    const user = users.find(u => u.username === username && u.enabled !== false);
    if (!user || user.password !== hashPwd(password))
      return json(res, 401, { error: '用户名或密码错误' });
    const sessions = cleanExpired();
    const idx = sessions.findIndex(s => s.username === username);
    if (idx >= 0) sessions.splice(idx, 1);
    const token = genToken();
    sessions.push({ token, username, role: user.role || 'user', createdAt: Date.now(), expiresAt: Date.now() + 7*24*3600*1000 });
    saveSessions(sessions);
    return json(res, 200, { token, username, role: user.role || 'user' });
  }

  if (url === '/api/register' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    if (!username || !password) return json(res, 400, { error: '请填写用户名和密码' });
    if (username.length < 2 || username.length > 30) return json(res, 400, { error: '用户名长度 2-30 位' });
    if (password.length < 4) return json(res, 400, { error: '密码至少 4 位' });
    if (!/^[a-zA-Z0-9_\-]+$/.test(username)) return json(res, 400, { error: '用户名只能包含字母数字下划线' });
    const users = loadUsers();
    if (users.find(u => u.username === username)) return json(res, 409, { error: '用户名已存在' });
    users.push({ username, password: hashPwd(password), role: 'user', enabled: true, createdAt: Date.now() });
    saveUsers(users);
    return json(res, 200, { message: '注册成功' });
  }

  if (url === '/api/verify' && req.method === 'POST') {
    const { token } = await parseBody(req);
    if (!token) return json(res, 400, { error: 'Missing token' });
    const sessions = cleanExpired();
    const session = sessions.find(s => s.token === token);
    if (!session) return json(res, 401, { error: 'Invalid token' });
    return json(res, 200, { username: session.username, role: session.role });
  }

  // --- Admin API (requires admin token) ---
  if (url === '/admin') return html(res, ADMIN_HTML);

  if (url.startsWith('/api/admin/')) {
    const sess = getSessionUser(req);
    if (!sess || sess.role !== 'admin') return json(res, 403, { error: '需要管理员权限' });

    if (url === '/api/admin/users') {
      const users = loadUsers();
      const sessions = loadSessions();
      const list = users.map(u => ({
        username: u.username,
        role: u.role || 'user',
        enabled: u.enabled !== false,
        createdAt: u.createdAt || 0,
        online: sessions.some(s => s.username === u.username && s.expiresAt > Date.now()),
      }));
      return json(res, 200, list);
    }

    if (url === '/api/admin/toggle' && req.method === 'POST') {
      const { username } = await parseBody(req);
      if (!username) return json(res, 400, { error: 'Missing username' });
      const users = loadUsers();
      const u = users.find(x => x.username === username);
      if (!u) return json(res, 404, { error: 'User not found' });
      if (u.role === 'admin') return json(res, 400, { error: '不能禁用管理员' });
      u.enabled = !u.enabled;
      saveUsers(users);
      if (!u.enabled) {
        const sessions = loadSessions().filter(s => s.username !== username);
        saveSessions(sessions);
      }
      return json(res, 200, { username, enabled: u.enabled });
    }

    if (url === '/api/admin/delete' && req.method === 'POST') {
      const { username } = await parseBody(req);
      if (!username) return json(res, 400, { error: 'Missing username' });
      let users = loadUsers();
      const u = users.find(x => x.username === username);
      if (!u) return json(res, 404, { error: 'User not found' });
      if (u.role === 'admin') return json(res, 400, { error: '不能删除管理员' });
      users = users.filter(x => x.username !== username);
      saveUsers(users);
      const sessions = loadSessions().filter(s => s.username !== username);
      saveSessions(sessions);
      return json(res, 200, { deleted: username });
    }

    if (url === '/api/admin/reset-password' && req.method === 'POST') {
      const { username, newPassword } = await parseBody(req);
      if (!username || !newPassword) return json(res, 400, { error: 'Missing fields' });
      if (newPassword.length < 4) return json(res, 400, { error: '密码至少 4 位' });
      const users = loadUsers();
      const u = users.find(x => x.username === username);
      if (!u) return json(res, 404, { error: 'User not found' });
      u.password = hashPwd(newPassword);
      saveUsers(users);
      return json(res, 200, { message: '密码已重置' });
    }

    return json(res, 404, { error: 'Not found' });
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth server running on port ${PORT}`);
  console.log(`Admin panel: http://0.0.0.0:${PORT}/admin`);
});
'''

ADMIN_HTML = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>管理后台 - 指纹浏览器</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:#0f0f11;color:#e8e8ed;min-height:100vh}
.container{max-width:900px;margin:0 auto;padding:24px}
.header{display:flex;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:1px solid #333340;margin-bottom:24px}
.header h1{font-size:20px;font-weight:600}
.header-right{display:flex;gap:8px;align-items:center}
.user-badge{font-size:13px;color:#9898a8;padding:6px 12px;background:#22222a;border-radius:8px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .15s}
.btn-primary{background:#6366f1;color:#fff}.btn-primary:hover{background:#818cf8}
.btn-danger{background:transparent;color:#ef4444;border:1px solid #ef4444}.btn-danger:hover{background:#ef4444;color:#fff}
.btn-success{background:transparent;color:#22c55e;border:1px solid #22c55e}.btn-success:hover{background:#22c55e;color:#fff}
.btn-sm{padding:5px 10px;font-size:12px}
.btn-ghost{background:transparent;color:#9898a8;border:1px solid #333340}.btn-ghost:hover{background:#22222a;color:#e8e8ed}

.login-panel{max-width:400px;margin:80px auto;background:#1a1a1f;border:1px solid #333340;border-radius:16px;padding:40px 32px}
.login-panel h2{text-align:center;margin-bottom:24px;font-size:18px}
.form-group{margin-bottom:16px}
.form-label{display:block;font-size:13px;color:#9898a8;margin-bottom:6px}
.form-input{width:100%;padding:10px 14px;background:#22222a;border:1px solid #333340;border-radius:8px;color:#e8e8ed;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s}
.form-input:focus{border-color:#6366f1}
.error{color:#ef4444;font-size:13px;margin-top:8px;display:none}
.error.show{display:block}

.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
.stat-card{background:#1a1a1f;border:1px solid #333340;border-radius:12px;padding:20px;text-align:center}
.stat-num{font-size:28px;font-weight:700;color:#6366f1}
.stat-label{font-size:12px;color:#9898a8;margin-top:4px}

.table{width:100%;border-collapse:collapse;background:#1a1a1f;border-radius:12px;overflow:hidden;border:1px solid #333340}
.table th,.table td{padding:12px 16px;text-align:left;border-bottom:1px solid #333340}
.table th{background:#22222a;font-size:12px;color:#9898a8;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.table td{font-size:13px}
.table tr:last-child td{border-bottom:none}
.table tr:hover td{background:#22222a}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
.tag-admin{background:#1e3a5f;color:#60a5fa}
.tag-user{background:#1a3a2a;color:#6ee7b7}
.tag-enabled{background:#1a3a2a;color:#6ee7b7}
.tag-disabled{background:#3a1a1a;color:#f87171}
.tag-online{background:#1a3a2a;color:#6ee7b7}
.tag-offline{background:#22222a;color:#666}
.actions{display:flex;gap:4px}

.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;align-items:center;justify-content:center}
.modal-overlay.active{display:flex}
.modal{background:#1a1a1f;border:1px solid #333340;border-radius:14px;width:400px;padding:24px}
.modal h3{margin-bottom:16px;font-size:16px}
.modal .form-group:last-of-type{margin-bottom:20px}
.modal-actions{display:flex;gap:8px;justify-content:flex-end}

.toast-box{position:fixed;bottom:24px;right:24px;z-index:2000}
.toast{padding:12px 20px;border-radius:8px;font-size:13px;margin-top:8px;animation:slideUp .2s}
.toast-ok{background:#065f46;color:#d1fae5}
.toast-err{background:#7f1d1d;color:#fecaca}
@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>

<div id="app-login" class="login-panel" style="display:none">
  <h2>&#128274; 管理员登录</h2>
  <div class="form-group">
    <label class="form-label">用户名</label>
    <input class="form-input" id="login-user" placeholder="管理员用户名" autofocus>
  </div>
  <div class="form-group">
    <label class="form-label">密码</label>
    <input class="form-input" id="login-pass" type="password" placeholder="密码">
  </div>
  <button class="btn btn-primary" style="width:100%" id="btn-login">登 录</button>
  <div class="error" id="login-error"></div>
</div>

<div id="app-main" style="display:none">
  <div class="container">
    <div class="header">
      <h1>&#128736; 用户管理后台</h1>
      <div class="header-right">
        <span class="user-badge" id="admin-name"></span>
        <button class="btn btn-ghost btn-sm" id="btn-logout">退出</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat-card"><div class="stat-num" id="stat-total">0</div><div class="stat-label">总用户数</div></div>
      <div class="stat-card"><div class="stat-num" id="stat-active">0</div><div class="stat-label">已启用</div></div>
      <div class="stat-card"><div class="stat-num" id="stat-online">0</div><div class="stat-label">在线</div></div>
    </div>

    <table class="table">
      <thead><tr><th>用户名</th><th>角色</th><th>状态</th><th>在线</th><th>注册时间</th><th>操作</th></tr></thead>
      <tbody id="user-tbody"></tbody>
    </table>
  </div>
</div>

<div class="modal-overlay" id="modal-reset">
  <div class="modal">
    <h3>重置密码</h3>
    <div class="form-group">
      <label class="form-label">用户: <strong id="reset-username"></strong></label>
    </div>
    <div class="form-group">
      <label class="form-label">新密码</label>
      <input class="form-input" id="reset-pass" type="password" placeholder="输入新密码">
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" onclick="$('#modal-reset').classList.remove('active')">取消</button>
      <button class="btn btn-primary btn-sm" id="btn-do-reset">确认重置</button>
    </div>
  </div>
</div>

<div class="toast-box" id="toast-box"></div>

<script>
const $=s=>document.querySelector(s);
let TOKEN='';
let USERS=[];

function toast(msg,ok=true){
  const t=document.createElement('div');
  t.className='toast '+(ok?'toast-ok':'toast-err');
  t.textContent=msg;
  $('#toast-box').appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

async function api(url,body={},method='POST'){
  const h={'Content-Type':'application/json'};
  if(TOKEN)h['Authorization']='Bearer '+TOKEN;
  const r=await fetch(url,{method,headers:h,body:method==='GET'?undefined:JSON.stringify(body)});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error||'请求失败');
  return d;
}

async function login(){
  const u=$('#login-user').value.trim();
  const p=$('#login-pass').value;
  if(!u||!p){$('#login-error').textContent='请填写用户名和密码';$('#login-error').classList.add('show');return}
  try{
    const d=await api('/api/login',{username:u,password:p});
    if(d.role!=='admin'){$('#login-error').textContent='此账号不是管理员';$('#login-error').classList.add('show');return}
    TOKEN=d.token;
    localStorage.setItem('admin_token',TOKEN);
    localStorage.setItem('admin_name',d.username);
    showMain(d.username);
  }catch(e){$('#login-error').textContent=e.message;$('#login-error').classList.add('show')}
}

function showMain(name){
  $('#app-login').style.display='none';
  $('#app-main').style.display='block';
  $('#admin-name').textContent='管理员: '+name;
  loadUsers();
}

async function loadUsers(){
  try{
    USERS=await api('/api/admin/users',{},'POST');
    renderUsers();
  }catch(e){toast(e.message,false)}
}

function renderUsers(){
  const total=USERS.length;
  const active=USERS.filter(u=>u.enabled).length;
  const online=USERS.filter(u=>u.online).length;
  $('#stat-total').textContent=total;
  $('#stat-active').textContent=active;
  $('#stat-online').textContent=online;

  $('#user-tbody').innerHTML=USERS.map(u=>{
    const date=u.createdAt?new Date(u.createdAt).toLocaleDateString('zh-CN'):'—';
    const isAdmin=u.role==='admin';
    return '<tr>'+
      '<td><strong>'+esc(u.username)+'</strong></td>'+
      '<td><span class="tag tag-'+(isAdmin?'admin':'user')+'">'+(isAdmin?'管理员':'用户')+'</span></td>'+
      '<td><span class="tag tag-'+(u.enabled?'enabled':'disabled')+'">'+(u.enabled?'已启用':'已禁用')+'</span></td>'+
      '<td><span class="tag tag-'+(u.online?'online':'offline')+'">'+(u.online?'在线':'离线')+'</span></td>'+
      '<td>'+date+'</td>'+
      '<td class="actions">'+
        (isAdmin?'':
          '<button class="btn btn-sm '+(u.enabled?'btn-danger':'btn-success')+'" onclick="toggleUser(\''+esc(u.username)+'\')">'+(u.enabled?'禁用':'启用')+'</button>'+
          '<button class="btn btn-ghost btn-sm" onclick="openReset(\''+esc(u.username)+'\')">重置密码</button>'+
          '<button class="btn btn-danger btn-sm" onclick="deleteUser(\''+esc(u.username)+'\')">删除</button>'
        )+
      '</td></tr>';
  }).join('');
}

async function toggleUser(username){
  try{await api('/api/admin/toggle',{username});toast(username+' 状态已切换');loadUsers()}catch(e){toast(e.message,false)}
}

async function deleteUser(username){
  if(!confirm('确定删除用户 '+username+'？'))return;
  try{await api('/api/admin/delete',{username});toast(username+' 已删除');loadUsers()}catch(e){toast(e.message,false)}
}

function openReset(username){
  $('#reset-username').textContent=username;
  $('#reset-pass').value='';
  $('#modal-reset').classList.add('active');
  $('#btn-do-reset').onclick=async()=>{
    const np=$('#reset-pass').value;
    if(!np||np.length<4){toast('密码至少4位',false);return}
    try{await api('/api/admin/reset-password',{username,newPassword:np});toast(username+' 密码已重置');$('#modal-reset').classList.remove('active')}catch(e){toast(e.message,false)}
  };
}

function esc(s){return s?s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[c])):''}

$('#btn-login').addEventListener('click',login);
$('#login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
$('#login-user').addEventListener('keydown',e=>{if(e.key==='Enter')$('#login-pass').focus()});
$('#btn-logout').addEventListener('click',()=>{TOKEN='';localStorage.clear();location.reload()});

(async()=>{
  const t=localStorage.getItem('admin_token');
  if(t){
    TOKEN=t;
    try{
      const d=await api('/api/verify',{token:t});
      if(d.role==='admin'){showMain(d.username||localStorage.getItem('admin_name'));return}
    }catch{}
  }
  $('#app-login').style.display='block';
})();
</script>
</body>
</html>'''

def run(ssh, cmd, check=True):
    print(f'  > {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    code = stdout.channel.recv_exit_status()
    if out: print(f'    {out[:200]}')
    if err and code != 0: print(f'    ERR: {err[:200]}')
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

    # Build final server.js with embedded HTML
    final_code = SERVER_CODE.replace('ADMIN_HTML_PLACEHOLDER', ADMIN_HTML.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${'))

    print('Deploying auth server with admin panel...')
    run(ssh, 'mkdir -p /opt/fp-browser-auth')

    sftp = ssh.open_sftp()
    with sftp.file('/opt/fp-browser-auth/server.js', 'w') as f:
        f.write(final_code)
    sftp.close()

    # Reset users.json to ensure admin account exists with correct password
    reset_cmd = '''node -e "
const crypto = require('crypto');
const fs = require('fs');
const f = '/opt/fp-browser-auth/users.json';
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
let users = [];
try { users = JSON.parse(fs.readFileSync(f,'utf-8')); } catch {}
const idx = users.findIndex(u => u.username === 'sunchao');
if (idx >= 0) { users[idx].password = hash('sunchao250'); users[idx].role = 'admin'; users[idx].enabled = true; }
else { users.push({username:'sunchao',password:hash('sunchao250'),role:'admin',enabled:true,createdAt:Date.now()}); }
// remove old admin
const oldAdmin = users.findIndex(u => u.username === 'admin' && u.role === 'admin');
if (oldAdmin >= 0) users.splice(oldAdmin, 1);
fs.writeFileSync(f, JSON.stringify(users, null, 2));
console.log('Users updated: ' + users.length + ' accounts');
"'''
    run(ssh, reset_cmd)

    # Create systemd service
    service = '''[Unit]
Description=FP Browser Auth Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/fp-browser-auth/server.js
Restart=always
RestartSec=5
WorkingDirectory=/opt/fp-browser-auth

[Install]
WantedBy=multi-user.target'''

    sftp = ssh.open_sftp()
    with sftp.file('/etc/systemd/system/fp-auth.service', 'w') as f:
        f.write(service)
    sftp.close()

    print('Restarting service...')
    run(ssh, 'systemctl daemon-reload')
    run(ssh, 'systemctl enable fp-auth')
    run(ssh, 'systemctl restart fp-auth')
    run(ssh, 'sleep 2')
    out, _ = run(ssh, 'systemctl is-active fp-auth')
    print(f'Service status: {out}')

    out, _ = run(ssh, 'curl -s http://127.0.0.1:3000/api/ping')
    print(f'Ping: {out}')

    # Open firewall for port 3000 if ufw is active
    run(ssh, 'ufw allow 3000/tcp 2>/dev/null || true', check=False)

    ssh.close()
    print(f'\nDone! Admin panel: http://{HOST}:3000/admin')
    print(f'Admin login: sunchao / sunchao250')

if __name__ == '__main__':
    main()
