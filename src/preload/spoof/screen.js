function spoofScreen(fp) {
  const screenConfig = fp.screen;
  if (!screenConfig) return;

  const screenOverrides = {
    width: screenConfig.width,
    height: screenConfig.height,
    availWidth: screenConfig.availWidth,
    availHeight: screenConfig.availHeight,
    colorDepth: screenConfig.colorDepth || 24,
    pixelDepth: screenConfig.pixelDepth || 24,
  };

  for (const [key, value] of Object.entries(screenOverrides)) {
    if (value !== undefined) {
      try {
        Object.defineProperty(Screen.prototype, key, {
          get: () => value,
          configurable: true,
        });
      } catch (_) {}
    }
  }

  if (screenConfig.devicePixelRatio !== undefined) {
    try {
      Object.defineProperty(window, 'devicePixelRatio', {
        get: () => screenConfig.devicePixelRatio,
        configurable: true,
      });
    } catch (_) {}
  }

  if (screenConfig.width !== undefined) {
    try {
      Object.defineProperty(window, 'outerWidth', {
        get: () => screenConfig.width,
        configurable: true,
      });
    } catch (_) {}
  }

  if (screenConfig.height !== undefined) {
    try {
      Object.defineProperty(window, 'outerHeight', {
        get: () => screenConfig.height,
        configurable: true,
      });
    } catch (_) {}
  }
}

module.exports = { spoofScreen };
