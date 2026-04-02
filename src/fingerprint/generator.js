const { PRESETS } = require('./presets');
const { ConsistencyChecker } = require('./consistency');

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

class FingerprintGenerator {
  static generate(seedStr) {
    const seed = seedStr
      ? hashString(seedStr)
      : (Math.random() * 0xffffffff) >>> 0;
    const rng = mulberry32(seed);

    const preset = PRESETS[Math.floor(rng() * PRESETS.length)];
    const fp = FingerprintGenerator.buildFromPreset(preset, rng, seed);

    ConsistencyChecker.enforce(fp);
    return fp;
  }

  static buildFromPreset(preset, rng, seed) {
    const chromeVersion = preset.chromeVersions[
      Math.floor(rng() * preset.chromeVersions.length)
    ];
    const majorVersion = chromeVersion.split('.')[0];

    const coreCount = preset.hardwareConcurrency[
      Math.floor(rng() * preset.hardwareConcurrency.length)
    ];
    const deviceMem = preset.deviceMemory[
      Math.floor(rng() * preset.deviceMemory.length)
    ];
    const gpu = preset.gpus[Math.floor(rng() * preset.gpus.length)];
    const screenRes = preset.screenResolutions[
      Math.floor(rng() * preset.screenResolutions.length)
    ];
    const lang = preset.languages[
      Math.floor(rng() * preset.languages.length)
    ];
    const tz = preset.timezones[Math.floor(rng() * preset.timezones.length)];
    const fonts = preset.fonts.slice(
      0,
      Math.floor(rng() * 5) + preset.fonts.length - 5
    );

    const userAgent = `Mozilla/5.0 (${preset.uaPlatformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

    const brandOrder = rng() > 0.5
      ? `"Chromium";v="${majorVersion}", "Google Chrome";v="${majorVersion}", "Not?A_Brand";v="99"`
      : `"Google Chrome";v="${majorVersion}", "Chromium";v="${majorVersion}", "Not?A_Brand";v="99"`;

    const fullVersionList = rng() > 0.5
      ? `"Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}", "Not?A_Brand";v="99.0.0.0"`
      : `"Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not?A_Brand";v="99.0.0.0"`;

    return {
      seed,
      userAgent,
      acceptLanguage: lang.accept,
      platform: preset.platform,
      clientHints: {
        brands: brandOrder,
        platform: preset.clientHintsPlatform,
        platformVersion: preset.platformVersion,
        mobile: false,
        fullVersionList,
        arch: preset.arch,
        bitness: preset.bitness,
        model: '',
      },
      navigator: {
        userAgent,
        platform: preset.platform,
        language: lang.primary,
        languages: lang.list,
        hardwareConcurrency: coreCount,
        deviceMemory: deviceMem,
        maxTouchPoints: preset.maxTouchPoints,
      },
      webgl: {
        vendor: gpu.vendor,
        renderer: gpu.renderer,
      },
      canvas: {
        noiseSeed: seed,
      },
      audio: {
        noiseSeed: seed + 1,
      },
      screen: {
        width: screenRes[0],
        height: screenRes[1],
        availWidth: screenRes[0],
        availHeight: screenRes[1] - (preset.taskbarHeight || 40),
        colorDepth: 24,
        pixelDepth: 24,
        devicePixelRatio: preset.dpr || 1,
      },
      timezone: {
        name: tz.name,
        offset: tz.offset,
      },
      fonts,
      webrtc: {
        mode: 'disable_non_proxied_udp',
      },
      plugins: preset.plugins || [],
    };
  }
}

module.exports = { FingerprintGenerator };
