(() => {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('spoof.js');
  s.onload = () => s.remove();
  (document.head || document.documentElement).prepend(s);
})();
