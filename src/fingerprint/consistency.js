class ConsistencyChecker {
  static enforce(fp) {
    ConsistencyChecker.alignUserAgent(fp);
    ConsistencyChecker.alignLanguage(fp);
    ConsistencyChecker.alignHardware(fp);
    ConsistencyChecker.alignPlatform(fp);
    return fp;
  }

  static alignUserAgent(fp) {
    if (!fp.userAgent || !fp.navigator) return;
    fp.navigator.userAgent = fp.userAgent;

    const match = fp.userAgent.match(/Chrome\/([\d.]+)/);
    if (match && fp.clientHints) {
      const fullVer = match[1];
      const major = fullVer.split('.')[0];
      if (fp.clientHints.brands && !fp.clientHints.brands.includes(major)) {
        fp.clientHints.brands = `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not?A_Brand";v="99"`;
      }
    }
  }

  static alignLanguage(fp) {
    if (!fp.navigator || !fp.acceptLanguage) return;
    const primary = fp.acceptLanguage.split(',')[0].split(';')[0].trim();
    fp.navigator.language = primary;
    if (!fp.navigator.languages || fp.navigator.languages.length === 0) {
      fp.navigator.languages = fp.acceptLanguage
        .split(',')
        .map((s) => s.split(';')[0].trim());
    }
  }

  static alignHardware(fp) {
    if (!fp.navigator) return;
    const cores = fp.navigator.hardwareConcurrency || 4;
    const mem = fp.navigator.deviceMemory || 8;
    if (cores <= 2 && mem > 8) fp.navigator.deviceMemory = 4;
    if (cores >= 16 && mem < 4) fp.navigator.deviceMemory = 8;
  }

  static alignPlatform(fp) {
    if (!fp.navigator || !fp.clientHints) return;
    const plat = fp.navigator.platform;
    if (plat === 'Win32') {
      fp.clientHints.platform = 'Windows';
      fp.clientHints.arch = 'x86';
      fp.clientHints.bitness = '64';
    } else if (plat === 'MacIntel') {
      fp.clientHints.platform = 'macOS';
      fp.clientHints.arch = 'arm';
      fp.clientHints.bitness = '64';
    } else if (plat === 'Linux x86_64') {
      fp.clientHints.platform = 'Linux';
      fp.clientHints.arch = 'x86';
      fp.clientHints.bitness = '64';
    }
  }

  static validate(fp) {
    const issues = [];

    if (fp.userAgent && fp.navigator && fp.userAgent !== fp.navigator.userAgent) {
      issues.push('User-Agent mismatch between HTTP header and navigator');
    }

    if (fp.navigator && fp.acceptLanguage) {
      const httpLang = fp.acceptLanguage.split(',')[0].split(';')[0].trim();
      if (fp.navigator.language !== httpLang) {
        issues.push('Language mismatch between Accept-Language and navigator.language');
      }
    }

    if (fp.navigator && fp.clientHints) {
      if (fp.navigator.platform === 'Win32' && fp.clientHints.platform !== 'Windows') {
        issues.push('Platform mismatch between navigator.platform and Sec-CH-UA-Platform');
      }
    }

    if (fp.navigator) {
      const cores = fp.navigator.hardwareConcurrency;
      const mem = fp.navigator.deviceMemory;
      if (cores <= 2 && mem > 16) {
        issues.push('Hardware mismatch: low cores with very high memory');
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

module.exports = { ConsistencyChecker };
