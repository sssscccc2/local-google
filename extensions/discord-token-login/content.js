// Content script for Discord Token Login Extension
// This script runs on Discord pages

(function() {
  'use strict';
  
  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'injectToken') {
      try {
        injectTokenToDiscord(request.token);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });
  
  // Function to inject token into Discord's localStorage
  function injectTokenToDiscord(token) {
    // Method 1: Using iframe trick for localStorage access
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      if (iframe.contentWindow && iframe.contentWindow.localStorage) {
        iframe.contentWindow.localStorage.setItem('token', JSON.stringify(token));
      }
      
      document.body.removeChild(iframe);
    } catch (e) {
      console.log('Iframe method failed:', e);
    }
    
    // Method 2: Direct localStorage (may work on some versions)
    try {
      localStorage.setItem('token', JSON.stringify(token));
    } catch (e) {
      console.log('Direct localStorage method failed:', e);
    }
    
    // Method 3: Using webpackChunkdiscord_app if available
    try {
      if (typeof webpackChunkdiscord_app !== 'undefined') {
        webpackChunkdiscord_app.push([
          [Math.random()],
          {},
          (req) => {
            for (const m of Object.keys(req.c).map((x) => req.c[x].exports).filter((x) => x)) {
              if (m.default && m.default.setToken) {
                m.default.setToken(token);
                break;
              }
              if (m.setToken) {
                m.setToken(token);
                break;
              }
            }
          }
        ]);
      }
    } catch (e) {
      console.log('Webpack method failed:', e);
    }
  }
  
  // Log that content script is loaded
  console.log('[Discord Token Login] Content script loaded');
})();

