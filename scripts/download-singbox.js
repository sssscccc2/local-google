const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION = '1.13.3';
const URL = `https://github.com/SagerNet/sing-box/releases/download/v${VERSION}/sing-box-${VERSION}-windows-amd64.zip`;
const BIN_DIR = path.join(__dirname, '..', 'bin');
const ZIP_PATH = path.join(BIN_DIR, 'sing-box.zip');
const EXE_PATH = path.join(BIN_DIR, 'sing-box.exe');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}`);
    const follow = (u) => {
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (total) {
            const pct = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`\r  ${pct}% (${(downloaded / 1048576).toFixed(1)}MB)`);
          }
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); console.log('\n  Done.'); resolve(); });
        file.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  if (fs.existsSync(EXE_PATH)) {
    console.log('sing-box.exe already exists, skipping download.');
    return;
  }

  fs.mkdirSync(BIN_DIR, { recursive: true });
  await download(URL, ZIP_PATH);

  console.log('Extracting...');
  try {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${BIN_DIR}' -Force"`,
      { stdio: 'inherit' }
    );
  } catch (e) {
    console.error('Extract failed:', e.message);
    process.exit(1);
  }

  const extracted = fs.readdirSync(BIN_DIR);
  for (const entry of extracted) {
    const full = path.join(BIN_DIR, entry);
    if (fs.statSync(full).isDirectory() && entry.startsWith('sing-box')) {
      const inner = path.join(full, 'sing-box.exe');
      if (fs.existsSync(inner)) {
        fs.copyFileSync(inner, EXE_PATH);
        fs.rmSync(full, { recursive: true, force: true });
        break;
      }
    }
  }

  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

  if (fs.existsSync(EXE_PATH)) {
    console.log(`sing-box v${VERSION} ready at ${EXE_PATH}`);
  } else {
    console.error('Failed to find sing-box.exe after extraction');
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
