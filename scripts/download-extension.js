const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_ID = 'edjlfkbjcjabbpncklbmnfniaellefmc';
const EXTENSION_NAME = 'discord-token-login';
const EXTENSIONS_DIR = path.join(__dirname, '..', 'extensions');
const OUTPUT_DIR = path.join(EXTENSIONS_DIR, EXTENSION_NAME);

const CRX_URL = `https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=132.0&x=id%3D${EXTENSION_ID}%26installsource%3Dondemand%26uc`;

function download(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, maxRedirects - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extractCrxToZip(crxBuffer) {
  const magic = crxBuffer.toString('ascii', 0, 4);
  if (magic !== 'Cr24') {
    throw new Error('Not a valid CRX file');
  }
  const version = crxBuffer.readUInt32LE(4);
  if (version === 3) {
    const headerLen = crxBuffer.readUInt32LE(8);
    return crxBuffer.slice(12 + headerLen);
  } else if (version === 2) {
    const pubKeyLen = crxBuffer.readUInt32LE(8);
    const sigLen = crxBuffer.readUInt32LE(12);
    return crxBuffer.slice(16 + pubKeyLen + sigLen);
  }
  throw new Error(`Unsupported CRX version: ${version}`);
}

async function main() {
  console.log(`Downloading extension: ${EXTENSION_ID}`);
  console.log(`From: ${CRX_URL}\n`);

  try {
    const crxBuffer = await download(CRX_URL);
    console.log(`Downloaded ${(crxBuffer.length / 1024).toFixed(1)} KB`);

    const zipBuffer = extractCrxToZip(crxBuffer);

    const tmpZip = path.join(EXTENSIONS_DIR, `${EXTENSION_NAME}.zip`);
    fs.writeFileSync(tmpZip, zipBuffer);
    console.log('CRX -> ZIP extracted');

    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true });
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    execSync(
      `powershell -Command "Expand-Archive -Path '${tmpZip}' -DestinationPath '${OUTPUT_DIR}' -Force"`,
      { stdio: 'inherit' }
    );

    fs.unlinkSync(tmpZip);

    if (fs.existsSync(path.join(OUTPUT_DIR, 'manifest.json'))) {
      console.log(`\nExtension installed to: ${OUTPUT_DIR}`);
      console.log('Done!');
    } else {
      console.error('Warning: manifest.json not found in extracted extension');
    }
  } catch (err) {
    console.error('Download failed:', err.message);
    console.log('\nYou can manually install the extension:');
    console.log('1. Download from Chrome Web Store');
    console.log('2. Extract to: ' + OUTPUT_DIR);
    console.log('3. Ensure manifest.json is in the root of that folder');
    process.exit(1);
  }
}

main();
