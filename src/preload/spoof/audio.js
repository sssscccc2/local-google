function spoofAudio(fp) {
  const seed = fp.audio?.noiseSeed ?? 0;
  if (!seed) return;

  const rng = createAudioRng(seed);

  patchAnalyserNode(rng);
  patchAudioContext(rng);
}

function createAudioRng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function patchAnalyserNode(rng) {
  if (typeof AnalyserNode === 'undefined') return;

  const origGetFloatFreq = AnalyserNode.prototype.getFloatFrequencyData;
  AnalyserNode.prototype.getFloatFrequencyData = function (array) {
    origGetFloatFreq.call(this, array);
    for (let i = 0; i < array.length; i += 10) {
      array[i] += (rng() - 0.5) * 0.001;
    }
  };

  const origGetByteFreq = AnalyserNode.prototype.getByteFrequencyData;
  AnalyserNode.prototype.getByteFrequencyData = function (array) {
    origGetByteFreq.call(this, array);
    for (let i = 0; i < array.length; i += 10) {
      const noise = Math.floor(rng() * 3) - 1;
      array[i] = Math.min(255, Math.max(0, array[i] + noise));
    }
  };

  const origGetFloatTime = AnalyserNode.prototype.getFloatTimeDomainData;
  AnalyserNode.prototype.getFloatTimeDomainData = function (array) {
    origGetFloatTime.call(this, array);
    for (let i = 0; i < array.length; i += 10) {
      array[i] += (rng() - 0.5) * 0.0001;
    }
  };
}

function patchAudioContext(rng) {
  if (typeof OfflineAudioContext === 'undefined') return;

  const origRendered = OfflineAudioContext.prototype.startRendering;
  OfflineAudioContext.prototype.startRendering = function () {
    return origRendered.call(this).then((buffer) => {
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i += 100) {
          data[i] += (rng() - 0.5) * 0.0000001;
        }
      }
      return buffer;
    });
  };
}

module.exports = { spoofAudio };
