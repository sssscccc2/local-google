const { contextBridge } = require('electron');
const path = require('path');

let partition = '';
for (const arg of process.argv) {
  if (arg.startsWith('--shell-partition=')) {
    partition = arg.slice('--shell-partition='.length);
  }
}

const preloadAbsPath = path.join(__dirname, 'preload.js');
const preloadPath = `file://${preloadAbsPath.replace(/\\/g, '/')}`;

contextBridge.exposeInMainWorld('shellApi', {
  partition,
  preloadPath,
});
