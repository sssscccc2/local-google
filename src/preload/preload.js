const { ipcRenderer } = require('electron');
const { spoofNavigator } = require('./spoof/navigator');
const { spoofCanvas } = require('./spoof/canvas');
const { spoofWebGL } = require('./spoof/webgl');
const { spoofAudio } = require('./spoof/audio');
const { spoofScreen } = require('./spoof/screen');
const { spoofTimezone } = require('./spoof/timezone');
const { spoofWebRTC } = require('./spoof/webrtc');
const { spoofFonts } = require('./spoof/fonts');
const { spoofPlugins } = require('./spoof/plugins');

(function initFingerprint() {
  let fp = null;

  try {
    fp = ipcRenderer.sendSync('fingerprint:get');
  } catch (_) {}

  if (!fp) {
    for (const arg of process.argv) {
      if (arg.startsWith('--fingerprint=')) {
        try {
          fp = JSON.parse(arg.slice('--fingerprint='.length));
        } catch (_) {}
      }
    }
  }

  if (!fp) return;

  const applyAll = () => {
    spoofNavigator(fp);
    spoofCanvas(fp);
    spoofWebGL(fp);
    spoofAudio(fp);
    spoofScreen(fp);
    spoofTimezone(fp);
    spoofWebRTC(fp);
    spoofFonts(fp);
    spoofPlugins(fp);
  };

  applyAll();

  document.addEventListener('DOMContentLoaded', () => {
    applyAll();
  });
})();
