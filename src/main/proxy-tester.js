const net = require('net');

const TEST_HOST = 'api.ipify.org';
const TEST_PORT = 80;
const TIMEOUT = 15000;

class ProxyTester {
  static test(proxy) {
    if (!proxy || !proxy.host || !proxy.port) {
      return Promise.reject(new Error('代理参数不完整'));
    }

    if (proxy.type === 'socks5') return ProxyTester._testSocks5(proxy);
    if (proxy.type === 'http') return ProxyTester._testHttp(proxy);
    return Promise.reject(new Error('不支持的代理类型: ' + proxy.type));
  }

  static _testSocks5(proxy) {
    return new Promise((resolve, reject) => {
      const sock = new net.Socket();
      let phase = 'greeting';
      let result = '';

      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error('连接超时（15秒）'));
      }, TIMEOUT);

      const fail = (msg) => {
        clearTimeout(timer);
        sock.destroy();
        reject(new Error(msg));
      };

      sock.connect(proxy.port, proxy.host, () => {
        const hasAuth = proxy.username && proxy.username.length > 0;
        const methods = hasAuth ? Buffer.from([0x05, 0x02, 0x00, 0x02]) : Buffer.from([0x05, 0x01, 0x00]);
        sock.write(methods);
      });

      sock.on('data', (data) => {
        if (phase === 'greeting') {
          if (data[0] !== 0x05) return fail('不是 SOCKS5 代理');
          const method = data[1];

          if (method === 0x02) {
            phase = 'auth';
            const user = Buffer.from(proxy.username || '');
            const pass = Buffer.from(proxy.password || '');
            const authBuf = Buffer.alloc(3 + user.length + pass.length);
            authBuf[0] = 0x01;
            authBuf[1] = user.length;
            user.copy(authBuf, 2);
            authBuf[2 + user.length] = pass.length;
            pass.copy(authBuf, 3 + user.length);
            sock.write(authBuf);
          } else if (method === 0x00) {
            phase = 'connect';
            sock.write(buildConnectRequest(TEST_HOST, TEST_PORT));
          } else if (method === 0xFF) {
            return fail('代理拒绝认证方式（可能需要用户名密码）');
          } else {
            return fail('不支持的认证方式: 0x' + method.toString(16));
          }
        } else if (phase === 'auth') {
          if (data[1] !== 0x00) return fail('认证失败（用户名或密码错误）');
          phase = 'connect';
          sock.write(buildConnectRequest(TEST_HOST, TEST_PORT));
        } else if (phase === 'connect') {
          if (data[0] !== 0x05 || data[1] !== 0x00) {
            const codes = {
              0x01: '服务器故障',
              0x02: '不允许的连接',
              0x03: '网络不可达',
              0x04: '主机不可达',
              0x05: '连接被拒',
              0x06: 'TTL 过期',
              0x07: '不支持的命令',
              0x08: '不支持的地址类型',
            };
            return fail('代理连接失败: ' + (codes[data[1]] || '错误码 0x' + data[1].toString(16)));
          }
          phase = 'http';
          sock.write(`GET / HTTP/1.1\r\nHost: ${TEST_HOST}\r\nConnection: close\r\n\r\n`);
        } else if (phase === 'http') {
          result += data.toString('utf-8');
        }
      });

      sock.on('end', () => {
        clearTimeout(timer);
        if (phase === 'http' && result) {
          const body = result.split('\r\n\r\n').pop().trim();
          const ipMatch = body.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
          if (ipMatch) {
            resolve({ success: true, ip: ipMatch[1] });
          } else {
            resolve({ success: true, ip: body.slice(0, 45) || '未知' });
          }
        } else {
          fail('连接异常断开 (phase: ' + phase + ')');
        }
      });

      sock.on('error', (err) => {
        clearTimeout(timer);
        if (err.code === 'ECONNREFUSED') fail('连接被拒绝 ' + proxy.host + ':' + proxy.port);
        else if (err.code === 'ENOTFOUND') fail('域名解析失败: ' + proxy.host);
        else if (err.code === 'ETIMEDOUT') fail('连接超时');
        else fail('连接错误: ' + err.message);
      });
    });
  }

  static _testHttp(proxy) {
    return new Promise((resolve, reject) => {
      const sock = new net.Socket();
      let result = '';

      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error('连接超时（15秒）'));
      }, TIMEOUT);

      const fail = (msg) => {
        clearTimeout(timer);
        sock.destroy();
        reject(new Error(msg));
      };

      sock.connect(proxy.port, proxy.host, () => {
        let connectStr = `CONNECT ${TEST_HOST}:443 HTTP/1.1\r\nHost: ${TEST_HOST}:443\r\n`;
        if (proxy.username) {
          const cred = Buffer.from(`${proxy.username}:${proxy.password || ''}`).toString('base64');
          connectStr += `Proxy-Authorization: Basic ${cred}\r\n`;
        }
        connectStr += '\r\n';

        sock.write(`GET http://${TEST_HOST}/ HTTP/1.1\r\nHost: ${TEST_HOST}\r\n`);
        if (proxy.username) {
          const cred = Buffer.from(`${proxy.username}:${proxy.password || ''}`).toString('base64');
          sock.write(`Proxy-Authorization: Basic ${cred}\r\n`);
        }
        sock.write('Connection: close\r\n\r\n');
      });

      sock.on('data', (d) => { result += d.toString('utf-8'); });

      sock.on('end', () => {
        clearTimeout(timer);
        const body = result.split('\r\n\r\n').pop().trim();
        const ipMatch = body.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (ipMatch) {
          resolve({ success: true, ip: ipMatch[1] });
        } else if (result.includes('407')) {
          fail('代理认证失败（407）');
        } else {
          resolve({ success: true, ip: body.slice(0, 45) || '响应异常' });
        }
      });

      sock.on('error', (err) => {
        clearTimeout(timer);
        if (err.code === 'ECONNREFUSED') fail('连接被拒绝 ' + proxy.host + ':' + proxy.port);
        else if (err.code === 'ENOTFOUND') fail('域名解析失败: ' + proxy.host);
        else fail('连接错误: ' + err.message);
      });
    });
  }
}

function buildConnectRequest(host, port) {
  const hostBuf = Buffer.from(host, 'ascii');
  const buf = Buffer.alloc(4 + 1 + hostBuf.length + 2);
  buf[0] = 0x05; // SOCKS version
  buf[1] = 0x01; // CONNECT
  buf[2] = 0x00; // reserved
  buf[3] = 0x03; // domain name
  buf[4] = hostBuf.length;
  hostBuf.copy(buf, 5);
  buf.writeUInt16BE(port, 5 + hostBuf.length);
  return buf;
}

module.exports = { ProxyTester };
