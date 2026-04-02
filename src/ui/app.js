const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let currentProfiles = [];
let presets = [];

async function init() {
  presets = await window.api.getPresets();
  await refreshList();
  bindEvents();

  const chromeInfo = await window.api.getChromeStatus();
  const indicator = document.createElement('span');
  indicator.style.cssText = 'font-size:12px;color:' + (chromeInfo.found ? '#22c55e' : '#ef4444');
  indicator.textContent = chromeInfo.found
    ? 'Chrome: ' + chromeInfo.path.split('\\').pop()
    : 'Chrome 未找到';
  document.querySelector('.header h1').after(indicator);
}

function bindEvents() {
  $('#btn-new-profile').addEventListener('click', () => openModal());
  $('#btn-new-profile-empty').addEventListener('click', () => openModal());
  $('#btn-modal-close').addEventListener('click', closeModal);
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#btn-save').addEventListener('click', handleSave);
  $('#btn-randomize').addEventListener('click', fillRandom);

  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('#modal-overlay')) closeModal();
  });
}

async function refreshList() {
  currentProfiles = await window.api.listProfiles();
  renderProfiles();
}

function renderProfiles() {
  const list = $('#profile-list');
  const empty = $('#empty-state');

  if (currentProfiles.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  list.style.display = 'grid';

  list.innerHTML = currentProfiles.map((p) => {
    const platform = detectPlatform(p.platform);
    const uaShort = p.userAgent
      ? p.userAgent.replace(/Mozilla\/5\.0\s*\([^)]+\)\s*/, '').slice(0, 50)
      : 'N/A';
    const created = p.createdAt
      ? new Date(p.createdAt).toLocaleDateString('zh-CN')
      : '';

    return `
      <div class="profile-card" data-id="${p.id}">
        <div class="profile-card-header">
          <span class="profile-name">${escapeHtml(p.name)}</span>
          <div class="profile-card-actions">
            <button class="btn-icon btn-edit" data-id="${p.id}" title="编辑">&#9998;</button>
            <button class="btn-icon btn-delete" data-id="${p.id}" title="删除">&#128465;</button>
          </div>
        </div>
        <div class="profile-meta">
          <div class="profile-meta-row">
            <span class="profile-meta-label">平台</span>
            <span class="tag tag-${platform.tag}">${platform.label}</span>
          </div>
          <div class="profile-meta-row">
            <span class="profile-meta-label">UA</span>
            <span class="profile-meta-value" title="${escapeHtml(p.userAgent)}">${escapeHtml(uaShort)}</span>
          </div>
        </div>
        <div class="profile-card-footer">
          <span class="profile-date">${created}</span>
          <button class="btn btn-primary btn-sm btn-launch" data-id="${p.id}">&#9654; 启动</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.btn-launch').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleLaunch(btn.dataset.id);
    });
  });

  list.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleEdit(btn.dataset.id);
    });
  });

  list.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete(btn.dataset.id);
    });
  });
}

function detectPlatform(platform) {
  if (platform === 'Win32') return { label: 'Windows', tag: 'windows' };
  if (platform === 'MacIntel') return { label: 'macOS', tag: 'macos' };
  if (platform && platform.includes('Linux')) return { label: 'Linux', tag: 'linux' };
  return { label: platform || 'Unknown', tag: 'windows' };
}

function openModal(editData) {
  const modal = $('#modal-overlay');
  modal.classList.add('active');

  if (editData) {
    $('#modal-title').textContent = '编辑配置';
    $('#edit-id').value = editData.id || '';
    fillFormFromProfile(editData);
  } else {
    $('#modal-title').textContent = '新建配置';
    $('#edit-id').value = '';
    resetForm();
    fillRandom();
  }
}

function closeModal() {
  $('#modal-overlay').classList.remove('active');
  resetForm();
}

function resetForm() {
  $('#input-name').value = '';
  $('#input-notes').value = '';
  $('#input-ua').value = '';
  $('#input-lang').value = '';
  $('#input-resolution').value = '';
  $('#input-timezone').value = '';
  $('#input-webgl-vendor').value = '';
  $('#input-webgl-renderer').value = '';
  $('#edit-id').value = '';
}

async function fillRandom() {
  const fp = await window.api.generateFingerprint();
  populateFormFromFingerprint(fp);
}

function populateFormFromFingerprint(fp) {
  if (!fp) return;

  if (fp.userAgent) $('#input-ua').value = fp.userAgent;
  if (fp.navigator) {
    if (fp.navigator.language) $('#input-lang').value = fp.navigator.language;
    if (fp.navigator.hardwareConcurrency) $('#select-cores').value = fp.navigator.hardwareConcurrency;
    if (fp.navigator.deviceMemory) $('#select-memory').value = fp.navigator.deviceMemory;

    const plat = fp.navigator.platform;
    if (plat === 'Win32') $('#select-platform').value = '0';
    else if (plat === 'MacIntel') $('#select-platform').value = '1';
    else if (plat && plat.includes('Linux')) $('#select-platform').value = '2';
  }
  if (fp.screen) {
    $('#input-resolution').value = `${fp.screen.width}x${fp.screen.height}`;
  }
  if (fp.timezone) {
    $('#input-timezone').value = fp.timezone.name;
  }
  if (fp.webgl) {
    $('#input-webgl-vendor').value = fp.webgl.vendor;
    $('#input-webgl-renderer').value = fp.webgl.renderer;
  }
  if (fp.webrtc) {
    $('#select-webrtc').value = fp.webrtc.mode;
  }
}

async function fillFormFromProfile(profile) {
  $('#input-name').value = profile.name || '';
  $('#input-notes').value = profile.notes || '';
  if (profile.fingerprint) {
    populateFormFromFingerprint(profile.fingerprint);
  }
}

function buildFingerprintFromForm() {
  const platformIdx = parseInt($('#select-platform').value, 10);
  const preset = presets[platformIdx] || presets[0];
  const seed = (Math.random() * 0xffffffff) >>> 0;

  const ua = $('#input-ua').value || null;
  const lang = $('#input-lang').value || 'zh-CN';
  const resParts = ($('#input-resolution').value || '1920x1080').split('x').map(Number);
  const tz = $('#input-timezone').value || 'Asia/Shanghai';
  const cores = parseInt($('#select-cores').value, 10) || 8;
  const mem = parseInt($('#select-memory').value, 10) || 8;
  const vendor = $('#input-webgl-vendor').value || preset.gpus[0].vendor;
  const renderer = $('#input-webgl-renderer').value || preset.gpus[0].renderer;
  const webrtcMode = $('#select-webrtc').value || 'disable_non_proxied_udp';

  const chromeVer = preset.chromeVersions[0];
  const majorVersion = chromeVer.split('.')[0];
  const userAgent = ua || `Mozilla/5.0 (${preset.uaPlatformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;

  const acceptMap = {
    'zh-CN': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'en-US': 'en-US,en;q=0.9',
    'ja': 'ja,en-US;q=0.9,en;q=0.8',
  };
  const acceptLang = acceptMap[lang] || `${lang},en;q=0.9`;

  const tzOffsets = {
    'Asia/Shanghai': -480,
    'America/New_York': 300,
    'America/Los_Angeles': 480,
    'Europe/London': 0,
    'Europe/Berlin': -60,
    'Asia/Tokyo': -540,
  };

  return {
    seed,
    userAgent,
    acceptLanguage: acceptLang,
    platform: preset.platform,
    clientHints: {
      brands: `"Chromium";v="${majorVersion}", "Google Chrome";v="${majorVersion}", "Not?A_Brand";v="99"`,
      platform: preset.clientHintsPlatform,
      platformVersion: preset.platformVersion,
      mobile: false,
      fullVersionList: `"Chromium";v="${chromeVer}", "Google Chrome";v="${chromeVer}", "Not?A_Brand";v="99.0.0.0"`,
      arch: preset.arch,
      bitness: preset.bitness,
      model: '',
    },
    navigator: {
      userAgent,
      platform: preset.platform,
      language: lang,
      languages: acceptLang.split(',').map((s) => s.split(';')[0].trim()),
      hardwareConcurrency: cores,
      deviceMemory: mem,
      maxTouchPoints: preset.maxTouchPoints,
    },
    webgl: { vendor, renderer },
    canvas: { noiseSeed: seed },
    audio: { noiseSeed: seed + 1 },
    screen: {
      width: resParts[0] || 1920,
      height: resParts[1] || 1080,
      availWidth: resParts[0] || 1920,
      availHeight: (resParts[1] || 1080) - (preset.taskbarHeight || 40),
      colorDepth: 24,
      pixelDepth: 24,
      devicePixelRatio: preset.dpr || 1,
    },
    timezone: {
      name: tz,
      offset: tzOffsets[tz] ?? -480,
    },
    fonts: preset.fonts,
    webrtc: { mode: webrtcMode },
    plugins: preset.plugins || [],
  };
}

async function handleSave() {
  const name = $('#input-name').value.trim();
  if (!name) {
    showToast('请输入配置名称', 'error');
    return;
  }

  const fingerprint = buildFingerprintFromForm();
  const editId = $('#edit-id').value;

  try {
    if (editId) {
      await window.api.updateProfile(editId, {
        name,
        notes: $('#input-notes').value,
        fingerprint,
      });
      showToast('配置已更新', 'success');
    } else {
      await window.api.createProfile({
        name,
        notes: $('#input-notes').value,
        fingerprint,
      });
      showToast('配置已创建', 'success');
    }
    closeModal();
    await refreshList();
  } catch (err) {
    showToast(err.message || '保存失败', 'error');
  }
}

async function handleLaunch(id) {
  try {
    const result = await window.api.launchProfile(id);
    showToast('Chrome 已启动 (PID: ' + result.pid + ')', 'success');
  } catch (err) {
    showToast(err.message || '启动失败', 'error');
  }
}

async function handleEdit(id) {
  const profile = await window.api.getProfile(id);
  if (profile) {
    openModal({ id, ...profile });
  }
}

async function handleDelete(id) {
  if (!confirm('确定要删除此配置吗？')) return;
  try {
    await window.api.deleteProfile(id);
    showToast('配置已删除', 'success');
    await refreshList();
  } catch (err) {
    showToast(err.message || '删除失败', 'error');
  }
}

function showToast(message, type = 'success') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[c]));
}

document.addEventListener('DOMContentLoaded', init);
