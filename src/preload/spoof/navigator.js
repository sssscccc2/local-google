function spoofNavigator(fp) {
  const nav = fp.navigator;
  if (!nav) return;

  const overrides = {
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    languages: Object.freeze([...nav.languages]),
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    webdriver: false,
  };

  for (const [key, value] of Object.entries(overrides)) {
    try {
      Object.defineProperty(Navigator.prototype, key, {
        get: () => value,
        configurable: true,
      });
    } catch (_) { /* some props may not be overridable */ }
  }

  if (nav.userAgent && fp.clientHints) {
    spoofUserAgentData(fp);
  }

  spoofWebdriver();
}

function spoofUserAgentData(fp) {
  const ch = fp.clientHints;
  const nav = fp.navigator;
  const match = nav.userAgent.match(/Chrome\/([\d.]+)/);
  const fullVersion = match ? match[1] : '132.0.6834.110';
  const majorVersion = fullVersion.split('.')[0];

  const uaData = {
    brands: [
      { brand: 'Chromium', version: majorVersion },
      { brand: 'Google Chrome', version: majorVersion },
      { brand: 'Not?A_Brand', version: '99' },
    ],
    mobile: ch.mobile || false,
    platform: ch.platform || 'Windows',
    getHighEntropyValues(hints) {
      const result = {
        brands: this.brands,
        mobile: this.mobile,
        platform: this.platform,
      };
      if (hints.includes('platformVersion')) result.platformVersion = ch.platformVersion || '15.0.0';
      if (hints.includes('architecture')) result.architecture = ch.arch || 'x86';
      if (hints.includes('bitness')) result.bitness = ch.bitness || '64';
      if (hints.includes('model')) result.model = ch.model || '';
      if (hints.includes('fullVersionList')) {
        result.fullVersionList = [
          { brand: 'Chromium', version: fullVersion },
          { brand: 'Google Chrome', version: fullVersion },
          { brand: 'Not?A_Brand', version: '99.0.0.0' },
        ];
      }
      if (hints.includes('uaFullVersion')) result.uaFullVersion = fullVersion;
      return Promise.resolve(result);
    },
    toJSON() {
      return { brands: this.brands, mobile: this.mobile, platform: this.platform };
    },
  };

  try {
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: () => uaData,
      configurable: true,
    });
  } catch (_) {}
}

function spoofWebdriver() {
  try {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => false,
      configurable: true,
    });
  } catch (_) {}

  delete Navigator.prototype.webdriver;
  Object.defineProperty(Navigator.prototype, 'webdriver', {
    get: () => undefined,
    configurable: true,
  });
}

module.exports = { spoofNavigator };
