class ProxyUrlParser {
  static parse(url) {
    url = url.trim();
    if (url.startsWith('vmess://')) return ProxyUrlParser._parseVmess(url);
    if (url.startsWith('vless://')) return ProxyUrlParser._parseVless(url);
    if (url.startsWith('ss://')) return ProxyUrlParser._parseShadowsocks(url);
    if (url.startsWith('trojan://')) return ProxyUrlParser._parseTrojan(url);
    if (url.startsWith('socks5://') || url.startsWith('socks://'))
      return ProxyUrlParser._parseSocks(url);
    if (url.startsWith('http://') || url.startsWith('https://'))
      return ProxyUrlParser._parseHttp(url);

    const plain = ProxyUrlParser._parsePlainText(url);
    if (plain) return plain;

    throw new Error(`不支持的协议: ${url.slice(0, 20)}...`);
  }

  static parseMultiple(text) {
    const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    const nodes = [];
    for (const line of lines) {
      try {
        nodes.push(ProxyUrlParser.parse(line));
      } catch (_) {}
    }
    return nodes;
  }

  static _parseVmess(url) {
    const b64 = url.slice(8);
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    let json;
    try {
      json = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
    } catch {
      throw new Error('VMess 链接 Base64 解析失败');
    }

    const node = {
      type: 'vmess',
      name: json.ps || json.add || 'VMess',
      server: json.add,
      server_port: parseInt(json.port, 10),
      uuid: json.id,
      alter_id: parseInt(json.aid || '0', 10),
      security: json.scy || 'auto',
    };

    if (json.net && json.net !== 'tcp') {
      node.transport = { type: json.net };
      if (json.net === 'ws') {
        node.transport.path = json.path || '/';
        if (json.host) node.transport.headers = { Host: json.host };
      }
      if (json.net === 'grpc') {
        node.transport.service_name = json.path || '';
      }
    }

    if (json.tls === 'tls') {
      node.tls = { enabled: true, server_name: json.sni || json.host || json.add };
    }

    return node;
  }

  static _parseVless(url) {
    const body = url.slice(8);
    const [mainPart, fragment] = body.split('#');
    const [userHost, queryStr] = mainPart.split('?');
    const [uuid, hostPort] = userHost.split('@');
    const [server, portStr] = ProxyUrlParser._splitHostPort(hostPort);
    const params = new URLSearchParams(queryStr || '');

    const node = {
      type: 'vless',
      name: fragment ? decodeURIComponent(fragment) : server,
      server,
      server_port: parseInt(portStr, 10),
      uuid,
      flow: params.get('flow') || '',
    };

    const security = params.get('security') || 'none';
    if (security === 'tls' || security === 'reality') {
      node.tls = {
        enabled: true,
        server_name: params.get('sni') || server,
      };
      if (security === 'reality') {
        node.tls.reality = {
          enabled: true,
          public_key: params.get('pbk') || '',
          short_id: params.get('sid') || '',
        };
      }
    }

    const transport = params.get('type');
    if (transport && transport !== 'tcp') {
      node.transport = { type: transport };
      if (transport === 'ws') {
        node.transport.path = params.get('path') || '/';
        const host = params.get('host');
        if (host) node.transport.headers = { Host: host };
      }
      if (transport === 'grpc') {
        node.transport.service_name = params.get('serviceName') || '';
      }
    }

    return node;
  }

  static _parseShadowsocks(url) {
    let body = url.slice(5);
    let name = '';
    const hashIdx = body.indexOf('#');
    if (hashIdx !== -1) {
      name = decodeURIComponent(body.slice(hashIdx + 1));
      body = body.slice(0, hashIdx);
    }

    let method, password, server, port;

    if (body.includes('@')) {
      const [userInfo, hostPort] = body.split('@');
      const decoded = ProxyUrlParser._b64Decode(userInfo);
      const colonIdx = decoded.indexOf(':');
      method = decoded.slice(0, colonIdx);
      password = decoded.slice(colonIdx + 1);
      [server, port] = ProxyUrlParser._splitHostPort(hostPort);
    } else {
      const decoded = ProxyUrlParser._b64Decode(body);
      const match = decoded.match(/^(.+?):(.+?)@(.+):(\d+)$/);
      if (!match) throw new Error('Shadowsocks 链接解析失败');
      [, method, password, server, port] = match;
    }

    return {
      type: 'shadowsocks',
      name: name || server,
      server,
      server_port: parseInt(port, 10),
      method,
      password,
    };
  }

  static _parseTrojan(url) {
    const body = url.slice(9);
    const [mainPart, fragment] = body.split('#');
    const [passwordHost, queryStr] = mainPart.split('?');
    const [password, hostPort] = passwordHost.split('@');
    const [server, portStr] = ProxyUrlParser._splitHostPort(hostPort);
    const params = new URLSearchParams(queryStr || '');

    const node = {
      type: 'trojan',
      name: fragment ? decodeURIComponent(fragment) : server,
      server,
      server_port: parseInt(portStr, 10),
      password,
      tls: {
        enabled: true,
        server_name: params.get('sni') || server,
      },
    };

    const transport = params.get('type');
    if (transport && transport !== 'tcp') {
      node.transport = { type: transport };
      if (transport === 'ws') {
        node.transport.path = params.get('path') || '/';
        const host = params.get('host');
        if (host) node.transport.headers = { Host: host };
      }
      if (transport === 'grpc') {
        node.transport.service_name = params.get('serviceName') || '';
      }
    }

    return node;
  }

  static _parseSocks(url) {
    const u = new URL(url.replace(/^socks5?:\/\//, 'http://'));
    return {
      type: 'socks',
      name: u.hash ? decodeURIComponent(u.hash.slice(1)) : u.hostname,
      server: u.hostname,
      server_port: parseInt(u.port || '1080', 10),
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  }

  static _parseHttp(url) {
    const u = new URL(url);
    return {
      type: 'http',
      name: u.hash ? decodeURIComponent(u.hash.slice(1)) : u.hostname,
      server: u.hostname,
      server_port: parseInt(u.port || '80', 10),
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  }

  static _parsePlainText(str) {
    const parts = str.split(':');
    if (parts.length < 2) return null;

    const portIdx = parts.findIndex(
      (p, i) => i > 0 && /^\d+$/.test(p) && parseInt(p, 10) <= 65535
    );
    if (portIdx < 1) return null;

    const host = parts.slice(0, portIdx).join(':');
    const port = parseInt(parts[portIdx], 10);
    const rest = parts.slice(portIdx + 1);

    let username, password;
    if (rest.length >= 2) {
      password = rest.pop();
      username = rest.join(':');
    } else if (rest.length === 1) {
      username = rest[0];
      password = '';
    }

    return {
      type: 'socks',
      name: `SOCKS5 ${host}:${port}`,
      server: host,
      server_port: port,
      username: username || undefined,
      password: password !== undefined ? password : undefined,
    };
  }

  static _splitHostPort(str) {
    if (str.startsWith('[')) {
      const close = str.indexOf(']');
      return [str.slice(1, close), str.slice(close + 2)];
    }
    const last = str.lastIndexOf(':');
    return [str.slice(0, last), str.slice(last + 1)];
  }

  static _b64Decode(str) {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf-8');
  }
}

module.exports = { ProxyUrlParser };
