function spoofWebRTC(fp) {
  const mode = fp.webrtc?.mode || 'disable_non_proxied_udp';

  if (mode === 'disabled') {
    disableWebRTC();
  } else if (mode === 'disable_non_proxied_udp') {
    restrictWebRTC();
  }
}

function disableWebRTC() {
  if (typeof RTCPeerConnection !== 'undefined') {
    window.RTCPeerConnection = undefined;
  }
  if (typeof webkitRTCPeerConnection !== 'undefined') {
    window.webkitRTCPeerConnection = undefined;
  }
  if (typeof mozRTCPeerConnection !== 'undefined') {
    window.mozRTCPeerConnection = undefined;
  }
  if (navigator.mediaDevices) {
    const origGetUserMedia = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = function () {
      return Promise.reject(new DOMException('Not allowed', 'NotAllowedError'));
    };
  }
}

function restrictWebRTC() {
  if (typeof RTCPeerConnection === 'undefined') return;

  const OrigRTCPeerConnection = RTCPeerConnection;
  const PUBLIC_STUN_SERVERS = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun3.l.google.com:19302',
    'stun:stun4.l.google.com:19302',
  ];

  window.RTCPeerConnection = function (config, constraints) {
    if (config && config.iceServers) {
      config.iceServers = config.iceServers.filter((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) =>
          PUBLIC_STUN_SERVERS.some((stun) => url.includes(stun))
        );
      });
    }

    const pc = new OrigRTCPeerConnection(config, constraints);

    const origAddIceCandidate = pc.addIceCandidate.bind(pc);
    pc.addIceCandidate = function (candidate, ...args) {
      if (candidate && candidate.candidate) {
        const c = candidate.candidate;
        if (isPrivateIP(c)) {
          return Promise.resolve();
        }
      }
      return origAddIceCandidate(candidate, ...args);
    };

    return pc;
  };

  window.RTCPeerConnection.prototype = OrigRTCPeerConnection.prototype;

  Object.defineProperty(window.RTCPeerConnection, 'name', {
    value: 'RTCPeerConnection',
    configurable: true,
  });
}

function isPrivateIP(candidateStr) {
  const ipv4Match = candidateStr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  if (!ipv4Match) return false;
  const ip = ipv4Match[1];
  const parts = ip.split('.').map(Number);
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  return false;
}

module.exports = { spoofWebRTC };
