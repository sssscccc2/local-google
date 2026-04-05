const net = require('net');

class Socks5Relay {
  constructor(remoteHost, remotePort, username, password) {
    this.remoteHost = remoteHost;
    this.remotePort = remotePort;
    this.username = username || '';
    this.password = password || '';
    this.server = null;
    this.localPort = 0;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((client) => this._handleClient(client));
      this.server.on('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        this.localPort = this.server.address().port;
        console.log(`[Relay] Listening 127.0.0.1:${this.localPort} → ${this.remoteHost}:${this.remotePort}`);
        resolve(this.localPort);
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  _handleClient(client) {
    let state = 'client_greeting';
    let connectReq = null;
    let remote = null;
    let remoteState = 'init';

    const log = (msg) => console.log(`[Relay:${client.remotePort}] ${msg}`);
    log('Client connected');

    client.on('data', (data) => {
      log(`State=${state} got ${data.length} bytes: ${data.slice(0, 20).toString('hex')}`);

      if (state === 'client_greeting') {
        if (data[0] !== 0x05) {
          log('Not SOCKS5, closing');
          client.end(Buffer.from([0x05, 0xFF]));
          return;
        }
        client.write(Buffer.from([0x05, 0x00]));
        state = 'client_request';
        log('Sent greeting response (no auth)');

        if (data.length > 2 + data[1]) {
          const extra = data.slice(2 + data[1]);
          log(`Greeting had extra ${extra.length} bytes, processing as request`);
          processRequest(extra);
        }
        return;
      }

      if (state === 'client_request') {
        processRequest(data);
        return;
      }
    });

    function processRequest(data) {
      if (data[0] !== 0x05 || data[1] !== 0x01) {
        log(`Bad request cmd=${data[1]}, closing`);
        client.end(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        return;
      }
      connectReq = Buffer.from(data);
      state = 'connecting_remote';

      let targetInfo = '';
      if (data[3] === 0x03) {
        const dLen = data[4];
        targetInfo = data.slice(5, 5 + dLen).toString('ascii') + ':' + data.readUInt16BE(5 + dLen);
      } else if (data[3] === 0x01) {
        targetInfo = `${data[4]}.${data[5]}.${data[6]}.${data[7]}:${data.readUInt16BE(8)}`;
      }
      log(`CONNECT to ${targetInfo}`);

      connectRemote();
    }

    const self = this;
    function connectRemote() {
      remote = new net.Socket();
      remoteState = 'greeting';

      log(`Connecting to remote ${self.remoteHost}:${self.remotePort}`);

      remote.connect(self.remotePort, self.remoteHost, () => {
        log('Remote TCP connected, sending SOCKS5 greeting');
        const hasAuth = self.username.length > 0;
        remote.write(hasAuth
          ? Buffer.from([0x05, 0x02, 0x00, 0x02])
          : Buffer.from([0x05, 0x01, 0x00])
        );
      });

      remote.on('data', (data) => {
        log(`Remote state=${remoteState} got ${data.length} bytes: ${data.slice(0, 20).toString('hex')}`);

        if (remoteState === 'greeting') {
          if (data[0] !== 0x05) {
            log('Remote not SOCKS5');
            sendError(0x01);
            return;
          }
          const method = data[1];
          log(`Remote chose auth method: ${method}`);

          if (method === 0x02) {
            remoteState = 'auth';
            const user = Buffer.from(self.username);
            const pass = Buffer.from(self.password);
            const buf = Buffer.alloc(3 + user.length + pass.length);
            buf[0] = 0x01;
            buf[1] = user.length;
            user.copy(buf, 2);
            buf[2 + user.length] = pass.length;
            pass.copy(buf, 3 + user.length);
            log(`Sending auth: user=${self.username} (${user.length}B), pass=(${pass.length}B)`);
            remote.write(buf);
          } else if (method === 0x00) {
            remoteState = 'connect';
            log('No auth needed, sending CONNECT');
            remote.write(connectReq);
          } else {
            log(`Unsupported method 0x${method.toString(16)}`);
            sendError(0x01);
          }
          return;
        }

        if (remoteState === 'auth') {
          if (data[1] !== 0x00) {
            log(`Auth FAILED: status=${data[1]}`);
            sendError(0x01);
            return;
          }
          remoteState = 'connect';
          log('Auth OK, sending CONNECT');
          remote.write(connectReq);
          return;
        }

        if (remoteState === 'connect') {
          log(`CONNECT response: status=${data[1]}`);
          if (data[1] !== 0x00) {
            sendError(data[1]);
            return;
          }
          remoteState = 'pipe';
          state = 'pipe';
          log('Pipe established');

          client.write(data);

          client.removeAllListeners('data');
          remote.removeAllListeners('data');
          client.pipe(remote);
          remote.pipe(client);
          return;
        }
      });

      remote.on('error', (err) => {
        log(`Remote error: ${err.code || err.message}`);
        sendError(0x05);
      });

      remote.on('close', () => {
        log('Remote closed');
        client.destroy();
      });
    }

    function sendError(code) {
      try {
        client.end(Buffer.from([0x05, code, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
      } catch (_) {}
      if (remote) remote.destroy();
    }

    client.on('error', (err) => {
      log(`Client error: ${err.code || err.message}`);
      if (remote) remote.destroy();
    });

    client.on('close', () => {
      log('Client closed');
      if (remote) remote.destroy();
    });
  }
}

module.exports = { Socks5Relay };
