// DOM Elements
const tokenInput = document.getElementById('tokenInput');
const toggleVisibility = document.getElementById('toggleVisibility');
const loginBtn = document.getElementById('loginBtn');
const saveBtn = document.getElementById('saveBtn');
const statusMessage = document.getElementById('statusMessage');
const savedTokensList = document.getElementById('savedTokensList');
const clearAllBtn = document.getElementById('clearAllBtn');
const tokenInfoCard = document.getElementById('tokenInfo');

// State
let isPasswordVisible = false;
let savedTokens = [];
let checkTokenTimeout = null;
let lastCheckedToken = '';
let currentTokenData = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSavedTokens();
  addEventListeners();
  addRippleEffect();
});

// Event Listeners
function addEventListeners() {
  toggleVisibility.addEventListener('click', togglePasswordVisibility);
  loginBtn.addEventListener('click', handleLogin);
  saveBtn.addEventListener('click', handleSaveToken);
  clearAllBtn.addEventListener('click', handleClearAll);
  
  tokenInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });
  
  // Check token on paste
  tokenInput.addEventListener('paste', (e) => {
    setTimeout(() => {
      const token = tokenInput.value.trim();
      if (token && isValidToken(token)) {
        checkToken(token);
      }
    }, 100);
  });
  
  // Check token on input with debounce
  tokenInput.addEventListener('input', () => {
    hideStatus();
    const token = tokenInput.value.trim();
    
    if (!token) {
      hideTokenInfo();
      lastCheckedToken = '';
      currentTokenData = null;
      return;
    }
    
    // Debounce token check
    clearTimeout(checkTokenTimeout);
    checkTokenTimeout = setTimeout(() => {
      if (isValidToken(token) && token !== lastCheckedToken) {
        checkToken(token);
      } else if (!isValidToken(token)) {
        hideTokenInfo();
      }
    }, 500);
  });
  
  // Copy ID button
  document.addEventListener('click', (e) => {
    if (e.target.closest('.copy-id-btn')) {
      const userId = document.getElementById('tokenUserId').textContent;
      navigator.clipboard.writeText(userId);
      showStatus('success', 'User ID copied!');
    }
  });
}

// Check token and show info
async function checkToken(token) {
  lastCheckedToken = token;
  
  // Show loading state
  tokenInfoCard.classList.remove('hidden');
  tokenInfoCard.querySelector('.token-info-loading').classList.remove('hidden');
  tokenInfoCard.querySelector('.token-info-content').classList.add('hidden');
  tokenInfoCard.querySelector('.token-info-error').classList.add('hidden');
  
  try {
    const response = await fetch('https://discord.com/api/v9/users/@me', {
      headers: {
        'Authorization': token
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      currentTokenData = data;
      showTokenInfo(data);
    } else {
      currentTokenData = null;
      const errorData = await response.json().catch(() => ({}));
      showTokenError(response.status, errorData);
    }
  } catch (error) {
    currentTokenData = null;
    showTokenError(0, { message: 'Network error' });
  }
}

// Show token info
function showTokenInfo(data) {
  tokenInfoCard.querySelector('.token-info-loading').classList.add('hidden');
  tokenInfoCard.querySelector('.token-info-error').classList.add('hidden');
  tokenInfoCard.querySelector('.token-info-content').classList.remove('hidden');
  
  // Avatar
  const avatarEl = document.getElementById('tokenAvatar');
  if (data.avatar) {
    const ext = data.avatar.startsWith('a_') ? 'gif' : 'png';
    avatarEl.src = `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${ext}?size=128`;
  } else {
    // Default avatar
    const defaultIndex = (BigInt(data.id) >> 22n) % 6n;
    avatarEl.src = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  }
  
  // Display Name & Username
  document.getElementById('tokenDisplayName').textContent = data.global_name || data.username;
  document.getElementById('tokenUsername').textContent = data.username;
  
  // Badges
  const badgesEl = document.getElementById('tokenBadges');
  badgesEl.innerHTML = '';
  
  if (data.premium_type) {
    const nitroBadge = document.createElement('i');
    nitroBadge.className = 'fa-solid fa-gem token-badge nitro';
    nitroBadge.title = data.premium_type === 3 ? 'Nitro Basic' : 'Nitro';
    badgesEl.appendChild(nitroBadge);
  }
  
  if (data.verified) {
    const verifiedBadge = document.createElement('i');
    verifiedBadge.className = 'fa-solid fa-circle-check token-badge verified';
    verifiedBadge.title = 'Verified Email';
    badgesEl.appendChild(verifiedBadge);
  }
  
  if (data.flags) {
    // Staff badge
    if (data.flags & 1) {
      const staffBadge = document.createElement('i');
      staffBadge.className = 'fa-solid fa-shield token-badge staff';
      staffBadge.title = 'Discord Staff';
      badgesEl.appendChild(staffBadge);
    }
  }
  
  // User ID
  document.getElementById('tokenUserId').textContent = data.id;
  
  // Created date (from snowflake ID)
  const createdDate = getDateFromSnowflake(data.id);
  document.getElementById('tokenCreated').textContent = formatDate(createdDate);
  
  // Email (masked)
  const emailEl = document.getElementById('tokenEmail');
  if (data.email) {
    emailEl.textContent = maskEmail(data.email);
    emailEl.classList.remove('error');
  } else {
    emailEl.textContent = 'Not linked';
    emailEl.classList.add('error');
  }
  
  // Phone
  const phoneEl = document.getElementById('tokenPhone');
  if (data.phone) {
    phoneEl.textContent = maskPhone(data.phone);
    phoneEl.classList.remove('error');
    phoneEl.classList.add('success');
  } else {
    phoneEl.textContent = 'Not linked';
    phoneEl.classList.add('error');
  }
  
  // 2FA
  const twoFaEl = document.getElementById('token2FA');
  if (data.mfa_enabled) {
    twoFaEl.textContent = 'Enabled';
    twoFaEl.classList.add('success');
    twoFaEl.classList.remove('error');
  } else {
    twoFaEl.textContent = 'Disabled';
    twoFaEl.classList.add('error');
    twoFaEl.classList.remove('success');
  }
}

// Show token error
function showTokenError(status, errorData) {
  tokenInfoCard.querySelector('.token-info-loading').classList.add('hidden');
  tokenInfoCard.querySelector('.token-info-content').classList.add('hidden');
  tokenInfoCard.querySelector('.token-info-error').classList.remove('hidden');
  
  const errorMsgEl = document.getElementById('tokenErrorMsg');
  
  switch (status) {
    case 401:
      errorMsgEl.textContent = 'Invalid or expired token';
      break;
    case 403:
      errorMsgEl.textContent = 'Account is banned or disabled';
      break;
    case 429:
      errorMsgEl.textContent = 'Rate limited - try again later';
      break;
    case 0:
      errorMsgEl.textContent = 'Network error - check your connection';
      break;
    default:
      errorMsgEl.textContent = errorData.message || 'Unknown error occurred';
  }
}

// Hide token info card
function hideTokenInfo() {
  tokenInfoCard.classList.add('hidden');
}

// Get date from Discord snowflake ID
function getDateFromSnowflake(snowflake) {
  const timestamp = Number(BigInt(snowflake) >> 22n) + 1420070400000;
  return new Date(timestamp);
}

// Format date
function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Mask email
function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}${name[1]}***@${domain}`;
}

// Mask phone
function maskPhone(phone) {
  if (phone.length <= 4) return phone;
  return `***${phone.slice(-4)}`;
}

// Toggle password visibility
function togglePasswordVisibility() {
  isPasswordVisible = !isPasswordVisible;
  tokenInput.type = isPasswordVisible ? 'text' : 'password';
  
  const eyeIcon = toggleVisibility.querySelector('.eye-icon');
  const eyeOffIcon = toggleVisibility.querySelector('.eye-off-icon');
  
  eyeIcon.classList.toggle('hidden', isPasswordVisible);
  eyeOffIcon.classList.toggle('hidden', !isPasswordVisible);
}

// Handle login
async function handleLogin() {
  const token = tokenInput.value.trim();
  
  if (!token) {
    showStatus('error', 'Please enter a token');
    return;
  }
  
  if (!isValidToken(token)) {
    showStatus('error', 'Invalid token format');
    return;
  }
  
  loginBtn.classList.add('loading');
  loginBtn.querySelector('.btn-icon').className = 'btn-icon fa-solid fa-spinner fa-spin';
  
  try {
    // Get current Discord tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url?.includes('discord.com')) {
      showStatus('error', 'Please open Discord website');
      loginBtn.classList.remove('loading');
      loginBtn.querySelector('.btn-icon').className = 'btn-icon fa-solid fa-right-to-bracket';
      return;
    }
    
    // Inject the token
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectToken,
      args: [token]
    });
    
    showStatus('success', 'Token applied successfully! Reloading...');
    
    // Reload the Discord tab
    setTimeout(() => {
      chrome.tabs.reload(tab.id);
    }, 1000);
    
  } catch (error) {
    console.error('Login error:', error);
    showStatus('error', 'Error occurred: ' + error.message);
  }
  
  loginBtn.classList.remove('loading');
  loginBtn.querySelector('.btn-icon').className = 'btn-icon fa-solid fa-right-to-bracket';
}

// Function to inject into Discord page
function injectToken(token) {
  // Set token in localStorage
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);
  
  const localStorage = iframe.contentWindow.localStorage;
  localStorage.setItem('token', `"${token}"`);
  
  document.body.removeChild(iframe);
  
  // Also try direct localStorage
  try {
    window.localStorage.setItem('token', `"${token}"`);
  } catch (e) {
    console.log('Direct localStorage failed, using iframe method');
  }
}

// Validate token format
function isValidToken(token) {
  // Discord tokens have specific patterns
  // User tokens: base64.base64.base64
  // Bot tokens: similar pattern
  const tokenPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  return tokenPattern.test(token) || token.length > 50;
}

// Handle save token
async function handleSaveToken() {
  const token = tokenInput.value.trim();
  
  if (!token) {
    showStatus('error', 'Enter a token to save');
    return;
  }
  
  if (!isValidToken(token)) {
    showStatus('error', 'Invalid token format');
    return;
  }
  
  // Check if token already saved
  if (savedTokens.some(t => t.token === token)) {
    showStatus('error', 'This token is already saved');
    return;
  }
  
  // Use cached token data if available
  let userName = 'Unknown';
  let avatarUrl = null;
  
  if (currentTokenData) {
    userName = currentTokenData.global_name || currentTokenData.username || 'Unknown';
    if (currentTokenData.avatar) {
      const ext = currentTokenData.avatar.startsWith('a_') ? 'gif' : 'png';
      avatarUrl = `https://cdn.discordapp.com/avatars/${currentTokenData.id}/${currentTokenData.avatar}.${ext}?size=64`;
    }
  } else {
    // Fetch user info if not cached
    try {
      const response = await fetch('https://discord.com/api/v9/users/@me', {
        headers: {
          'Authorization': token
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        userName = data.global_name || data.username || 'Unknown';
        if (data.avatar) {
          const ext = data.avatar.startsWith('a_') ? 'gif' : 'png';
          avatarUrl = `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${ext}?size=64`;
        }
      }
    } catch (e) {
      console.log('Could not fetch user info');
    }
  }
  
  const newToken = {
    id: Date.now().toString(),
    token: token,
    name: userName,
    avatar: avatarUrl,
    preview: token.substring(0, 20) + '...',
    createdAt: new Date().toISOString()
  };
  
  savedTokens.push(newToken);
  await saveSavedTokens();
  renderSavedTokens();
  
  showStatus('success', 'Token saved successfully!');
  tokenInput.value = '';
  hideTokenInfo();
  lastCheckedToken = '';
  currentTokenData = null;
}

// Load saved tokens
async function loadSavedTokens() {
  try {
    const result = await chrome.storage.local.get(['savedTokens']);
    savedTokens = result.savedTokens || [];
    renderSavedTokens();
  } catch (error) {
    console.error('Error loading tokens:', error);
    savedTokens = [];
  }
}

// Save tokens to storage
async function saveSavedTokens() {
  try {
    await chrome.storage.local.set({ savedTokens });
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

// Render saved tokens list
function renderSavedTokens() {
  if (savedTokens.length === 0) {
    savedTokensList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-user-slash"></i>
        <p>No saved tokens</p>
      </div>
    `;
    return;
  }
  
  savedTokensList.innerHTML = savedTokens.map(token => `
    <div class="token-item" data-id="${token.id}">
      <div class="token-avatar">${token.avatar ? `<img src="${token.avatar}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : getInitials(token.name)}</div>
      <div class="token-info">
        <div class="token-name">${escapeHtml(token.name)}</div>
        <div class="token-preview">${escapeHtml(token.preview)}</div>
      </div>
      <div class="token-actions">
        <button class="token-action-btn use-btn" title="Use token" data-token="${escapeHtml(token.token)}">
          <i class="fa-solid fa-right-to-bracket"></i>
        </button>
        <button class="token-action-btn delete-btn" title="Delete" data-id="${token.id}">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners to buttons
  document.querySelectorAll('.use-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tokenInput.value = btn.dataset.token;
      checkToken(btn.dataset.token);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteToken(btn.dataset.id);
    });
  });
}

// Delete a single token
async function deleteToken(id) {
  savedTokens = savedTokens.filter(t => t.id !== id);
  await saveSavedTokens();
  renderSavedTokens();
  showStatus('success', 'Token deleted');
}

// Clear all tokens
async function handleClearAll() {
  if (savedTokens.length === 0) return;
  
  savedTokens = [];
  await saveSavedTokens();
  renderSavedTokens();
  showStatus('success', 'All tokens cleared');
}

// Show status message
function showStatus(type, message) {
  statusMessage.className = `status-message ${type}`;
  
  const iconClass = type === 'success' 
    ? 'fa-solid fa-circle-check'
    : 'fa-solid fa-circle-xmark';
  
  statusMessage.querySelector('.status-icon').className = `status-icon ${iconClass}`;
  statusMessage.querySelector('.status-text').textContent = message;
  
  // Auto hide after 4 seconds
  setTimeout(() => {
    hideStatus();
  }, 4000);
}

// Hide status message
function hideStatus() {
  statusMessage.classList.add('hidden');
}

// Helper functions
function getInitials(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Ripple effect
function addRippleEffect() {
  document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
}
