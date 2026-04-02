async function applyHeaderRules() {
  let config;
  try {
    const resp = await fetch(chrome.runtime.getURL('config.json'));
    config = await resp.json();
  } catch (e) {
    console.warn('Fingerprint config not found');
    return;
  }

  const requestHeaders = [];

  if (config.userAgent) {
    requestHeaders.push({ header: 'User-Agent', operation: 'set', value: config.userAgent });
  }
  if (config.acceptLanguage) {
    requestHeaders.push({ header: 'Accept-Language', operation: 'set', value: config.acceptLanguage });
  }
  if (config.clientHints) {
    const ch = config.clientHints;
    if (ch.brands) requestHeaders.push({ header: 'Sec-CH-UA', operation: 'set', value: ch.brands });
    if (ch.platform) requestHeaders.push({ header: 'Sec-CH-UA-Platform', operation: 'set', value: `"${ch.platform}"` });
    if (ch.platformVersion) requestHeaders.push({ header: 'Sec-CH-UA-Platform-Version', operation: 'set', value: `"${ch.platformVersion}"` });
    if (ch.mobile !== undefined) requestHeaders.push({ header: 'Sec-CH-UA-Mobile', operation: 'set', value: ch.mobile ? '?1' : '?0' });
    if (ch.fullVersionList) requestHeaders.push({ header: 'Sec-CH-UA-Full-Version-List', operation: 'set', value: ch.fullVersionList });
    if (ch.arch) requestHeaders.push({ header: 'Sec-CH-UA-Arch', operation: 'set', value: `"${ch.arch}"` });
    if (ch.bitness) requestHeaders.push({ header: 'Sec-CH-UA-Bitness', operation: 'set', value: `"${ch.bitness}"` });
    if (ch.model !== undefined) requestHeaders.push({ header: 'Sec-CH-UA-Model', operation: 'set', value: `"${ch.model}"` });
  }

  requestHeaders.push({ header: 'DNT', operation: 'set', value: '1' });
  requestHeaders.push({ header: 'Sec-GPC', operation: 'set', value: '1' });

  if (requestHeaders.length === 0) return;

  const allTypes = [
    'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
    'font', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
  ];

  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: [{
        id: 1,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders },
        condition: { urlFilter: '|http', resourceTypes: allTypes }
      }]
    });
    console.log('Header rules applied');
  } catch (e) {
    console.error('Failed to apply header rules:', e);
  }
}

chrome.runtime.onInstalled.addListener(() => applyHeaderRules());
chrome.runtime.onStartup.addListener(() => applyHeaderRules());
applyHeaderRules();
