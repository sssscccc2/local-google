const webview = document.getElementById('browser');
const urlBar = document.getElementById('url-bar');
const btnBack = document.getElementById('btn-back');
const btnForward = document.getElementById('btn-forward');
const btnReload = document.getElementById('btn-reload');
const loadingBar = document.getElementById('loading-bar');
const sslIndicator = document.getElementById('ssl-indicator');

const config = window.shellApi;

webview.partition = config.partition;
webview.preload = config.preloadPath;

webview.src = 'https://www.google.com';

function navigateTo(input) {
  let url = input.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('file://')) {
    if (url.includes('.') && !url.includes(' ')) {
      url = 'https://' + url;
    } else {
      url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
    }
  }
  webview.loadURL(url);
}

urlBar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    navigateTo(urlBar.value);
    urlBar.blur();
  }
});

urlBar.addEventListener('focus', () => {
  setTimeout(() => urlBar.select(), 0);
});

btnBack.addEventListener('click', () => {
  if (webview.canGoBack()) webview.goBack();
});

btnForward.addEventListener('click', () => {
  if (webview.canGoForward()) webview.goForward();
});

btnReload.addEventListener('click', () => {
  webview.reload();
});

webview.addEventListener('did-navigate', (e) => {
  urlBar.value = e.url;
  updateSSL(e.url);
});

webview.addEventListener('did-navigate-in-page', (e) => {
  if (e.isMainFrame) {
    urlBar.value = e.url;
    updateSSL(e.url);
  }
});

webview.addEventListener('did-start-loading', () => {
  loadingBar.className = 'loading-bar active';
});

webview.addEventListener('did-stop-loading', () => {
  loadingBar.className = 'loading-bar done';
  setTimeout(() => { loadingBar.className = 'loading-bar'; }, 500);
});

webview.addEventListener('page-title-updated', (e) => {
  document.title = e.title || 'Fingerprint Browser';
});

webview.addEventListener('new-window', (e) => {
  webview.loadURL(e.url);
});

function updateSSL(url) {
  if (url.startsWith('https://')) {
    sslIndicator.textContent = '\u{1F512}';
    sslIndicator.className = 'ssl-indicator';
  } else if (url.startsWith('http://')) {
    sslIndicator.textContent = '\u26A0';
    sslIndicator.className = 'ssl-indicator insecure';
  } else {
    sslIndicator.textContent = '';
  }
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault();
    urlBar.focus();
  }
  if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
    e.preventDefault();
    webview.reload();
  }
  if ((e.altKey) && e.key === 'ArrowLeft') {
    e.preventDefault();
    if (webview.canGoBack()) webview.goBack();
  }
  if ((e.altKey) && e.key === 'ArrowRight') {
    e.preventDefault();
    if (webview.canGoForward()) webview.goForward();
  }
});
