const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const isPacked = app.isPackaged;

const APP_ROOT = isPacked
  ? path.dirname(app.getPath('exe'))
  : path.join(__dirname, '..', '..');

const RESOURCES = isPacked
  ? process.resourcesPath
  : APP_ROOT;

const DATA_DIR = path.join(APP_ROOT, 'data');
const EXTENSIONS_DIR = path.join(RESOURCES, 'extensions');
const TEMPLATE_DIR = isPacked
  ? path.join(RESOURCES, 'extension-template')
  : path.join(__dirname, '..', 'extension-template');

fs.mkdirSync(DATA_DIR, { recursive: true });

module.exports = { APP_ROOT, DATA_DIR, EXTENSIONS_DIR, TEMPLATE_DIR, isPacked };
