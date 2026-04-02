function spoofPlugins(fp) {
  const pluginList = fp.plugins;
  if (!pluginList) return;

  const fakePlugins = pluginList.map((p, i) => createFakePlugin(p, i));

  const pluginArray = {
    length: fakePlugins.length,
    item: (i) => fakePlugins[i] || null,
    namedItem: (name) => fakePlugins.find((p) => p.name === name) || null,
    refresh: () => {},
    [Symbol.iterator]: function* () {
      for (const p of fakePlugins) yield p;
    },
  };

  for (let i = 0; i < fakePlugins.length; i++) {
    pluginArray[i] = fakePlugins[i];
  }

  try {
    Object.defineProperty(Navigator.prototype, 'plugins', {
      get: () => pluginArray,
      configurable: true,
    });
  } catch (_) {}

  const fakeMimeTypes = [];
  fakePlugins.forEach((p) => {
    fakeMimeTypes.push({
      type: 'application/pdf',
      suffixes: 'pdf',
      description: p.description,
      enabledPlugin: p,
    });
  });

  const mimeTypeArray = {
    length: fakeMimeTypes.length,
    item: (i) => fakeMimeTypes[i] || null,
    namedItem: (name) => fakeMimeTypes.find((m) => m.type === name) || null,
    [Symbol.iterator]: function* () {
      for (const m of fakeMimeTypes) yield m;
    },
  };

  for (let i = 0; i < fakeMimeTypes.length; i++) {
    mimeTypeArray[i] = fakeMimeTypes[i];
  }

  try {
    Object.defineProperty(Navigator.prototype, 'mimeTypes', {
      get: () => mimeTypeArray,
      configurable: true,
    });
  } catch (_) {}
}

function createFakePlugin(config, index) {
  return {
    name: config.name,
    filename: config.filename,
    description: config.description || '',
    length: 1,
    item: () => null,
    namedItem: () => null,
    [Symbol.toStringTag]: 'Plugin',
  };
}

module.exports = { spoofPlugins };
