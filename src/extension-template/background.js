async function loadConfig() {
  try {
    const resp = await fetch(chrome.runtime.getURL('config.json'));
    return await resp.json();
  } catch (e) {
    console.warn('Fingerprint config not found');
    return null;
  }
}

async function applyHeaderRules(config) {
  if (!config) return;

  const requestHeaders = [];
  const responseHeaders = [];

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

  const proxyLeakHeaders = [
    'Via', 'X-Forwarded-For', 'X-Forwarded-Host', 'X-Forwarded-Proto',
    'X-Real-IP', 'Forwarded', 'Proxy-Connection', 'X-Proxy-ID',
    'X-Client-IP', 'Client-IP', 'CF-Connecting-IP'
  ];
  for (const h of proxyLeakHeaders) {
    requestHeaders.push({ header: h, operation: 'remove' });
  }

  requestHeaders.push({ header: 'DNT', operation: 'remove' });
  requestHeaders.push({ header: 'Sec-GPC', operation: 'remove' });

  for (const h of ['Via', 'X-Proxy-ID', 'Proxy-Connection', 'X-Powered-By']) {
    responseHeaders.push({ header: h, operation: 'remove' });
  }

  if (requestHeaders.length === 0 && responseHeaders.length === 0) return;

  const allTypes = [
    'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
    'font', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'
  ];

  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);

    const rules = [];
    if (requestHeaders.length > 0) {
      rules.push({
        id: 1,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders },
        condition: { urlFilter: '|http', resourceTypes: allTypes }
      });
    }
    if (responseHeaders.length > 0) {
      rules.push({
        id: 2,
        priority: 1,
        action: { type: 'modifyHeaders', responseHeaders },
        condition: { urlFilter: '|http', resourceTypes: allTypes }
      });
    }

    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: rules });
    console.log('[FG] Header rules applied');
  } catch (e) {
    console.error('[FG] Failed to apply header rules:', e);
  }
}

function setupProxyAuth(config) {
  const proxy = config && config.proxy;
  if (!proxy || !proxy.username) return;

  chrome.webRequest.onAuthRequired.addListener(
    (details, callback) => {
      callback({
        authCredentials: {
          username: proxy.username,
          password: proxy.password || ''
        }
      });
    },
    { urls: ['<all_urls>'] },
    ['asyncBlocking']
  );
  console.log('[FG] Proxy auth handler registered');
}

async function init() {
  const config = await loadConfig();
  if (!config) return;
  await applyHeaderRules(config);
  setupProxyAuth(config);
}

chrome.runtime.onInstalled.addListener(() => init());
chrome.runtime.onStartup.addListener(() => init());
init();
