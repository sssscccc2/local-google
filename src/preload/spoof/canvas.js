function spoofCanvas(fp) {
  const seed = fp.canvas?.noiseSeed ?? 0;
  if (!seed) return;

  const rng = createSeededRng(seed);

  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (...args) {
    const imageData = origGetImageData.apply(this, args);
    addNoiseToImageData(imageData, rng);
    return imageData;
  };

  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function (...args) {
    injectCanvasNoise(this, rng);
    return origToDataURL.apply(this, args);
  };

  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (...args) {
    injectCanvasNoise(this, rng);
    return origToBlob.apply(this, args);
  };
}

function createSeededRng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addNoiseToImageData(imageData, rng) {
  const data = imageData.data;
  const len = data.length;
  const step = Math.max(1, Math.floor(len / 100));
  for (let i = 0; i < len; i += step * 4) {
    const noise = Math.floor(rng() * 3) - 1;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
  }
}

function injectCanvasNoise(canvas, rng) {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;
    const imageData = ctx.getImageData(0, 0, Math.min(w, 16), Math.min(h, 16));
    const noise = Math.floor(rng() * 3) - 1;
    if (imageData.data.length > 0) {
      imageData.data[0] = Math.min(255, Math.max(0, imageData.data[0] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
  } catch (_) {}
}

module.exports = { spoofCanvas };
