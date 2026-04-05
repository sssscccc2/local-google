// Background service worker for Discord Token Login Extension

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Discord Token Login] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[Discord Token Login] Extension updated');
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkDiscordTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const isDiscord = tabs[0]?.url?.includes('discord.com');
      sendResponse({ isDiscord });
    });
    return true;
  }
  
  if (request.action === 'validateToken') {
    validateToken(request.token)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ valid: false, error: error.message }));
    return true;
  }
});

// Validate token by making API request
async function validateToken(token) {
  try {
    const response = await fetch('https://discord.com/api/v9/users/@me', {
      headers: {
        'Authorization': token
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        user: {
          id: data.id,
          username: data.username,
          discriminator: data.discriminator,
          avatar: data.avatar,
          email: data.email
        }
      };
    } else {
      return { valid: false, error: 'Invalid token' };
    }
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

