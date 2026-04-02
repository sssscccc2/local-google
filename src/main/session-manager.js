class SessionManager {
  static applyHeaders(ses, fingerprint) {
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = details.requestHeaders;

      if (fingerprint.userAgent) {
        headers['User-Agent'] = fingerprint.userAgent;
      }
      if (fingerprint.acceptLanguage) {
        headers['Accept-Language'] = fingerprint.acceptLanguage;
      }

      if (fingerprint.clientHints) {
        const ch = fingerprint.clientHints;
        if (ch.brands) {
          headers['Sec-CH-UA'] = ch.brands;
        }
        if (ch.platform) {
          headers['Sec-CH-UA-Platform'] = `"${ch.platform}"`;
        }
        if (ch.platformVersion) {
          headers['Sec-CH-UA-Platform-Version'] = `"${ch.platformVersion}"`;
        }
        if (ch.mobile !== undefined) {
          headers['Sec-CH-UA-Mobile'] = ch.mobile ? '?1' : '?0';
        }
        if (ch.fullVersionList) {
          headers['Sec-CH-UA-Full-Version-List'] = ch.fullVersionList;
        }
        if (ch.arch) {
          headers['Sec-CH-UA-Arch'] = `"${ch.arch}"`;
        }
        if (ch.bitness) {
          headers['Sec-CH-UA-Bitness'] = `"${ch.bitness}"`;
        }
        if (ch.model) {
          headers['Sec-CH-UA-Model'] = `"${ch.model}"`;
        }
      }

      headers['DNT'] = '1';
      headers['Sec-GPC'] = '1';

      callback({ requestHeaders: headers });
    });

    if (fingerprint.userAgent) {
      ses.setUserAgent(fingerprint.userAgent);
    }
  }
}

module.exports = { SessionManager };
