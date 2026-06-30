// ============================================================
//  Analyse audio côté navigateur (Web Audio API)
//  -> durée, BPM estimé, énergie -> suggestion d'ambiance
//  Aucune dépendance externe.
// ============================================================
window.RysaoAudio = (function () {
  function fmtDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // Détection de BPM : filtre passe-bas (grosse caisse) puis
  // détection de pics et intervalle le plus fréquent.
  async function detectBPM(buffer) {
    const offline = new OfflineAudioContext(
      1,
      buffer.length,
      buffer.sampleRate
    );
    const source = offline.createBufferSource();
    source.buffer = buffer;

    const lowpass = offline.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 150;
    lowpass.Q.value = 1;

    const highpass = offline.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 90;

    source.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    const data = rendered.getChannelData(0);

    // Seuil dynamique de détection de pics.
    let max = 0;
    for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
    const threshold = max * 0.4;

    const peaks = [];
    const minGap = Math.round(rendered.sampleRate * 0.25); // 240 BPM max
    let i = 0;
    while (i < data.length) {
      if (Math.abs(data[i]) > threshold) {
        peaks.push(i);
        i += minGap;
      } else {
        i++;
      }
    }

    if (peaks.length < 4) return null;

    // Histogramme des intervalles -> BPM candidats.
    const counts = {};
    for (let p = 0; p < peaks.length - 1; p++) {
      for (let q = p + 1; q < Math.min(p + 10, peaks.length); q++) {
        const gap = peaks[q] - peaks[p];
        let bpm = (60 * rendered.sampleRate) / gap;
        while (bpm < 80) bpm *= 2;
        while (bpm > 180) bpm /= 2;
        const rounded = Math.round(bpm);
        counts[rounded] = (counts[rounded] || 0) + 1;
      }
    }
    let best = null,
      bestCount = 0;
    for (const [bpm, c] of Object.entries(counts)) {
      if (c > bestCount) {
        bestCount = c;
        best = Number(bpm);
      }
    }
    return best;
  }

  // Énergie RMS moyenne -> ambiance suggérée.
  function guessMood(buffer, bpm) {
    const data = buffer.getChannelData(0);
    let sum = 0;
    const step = Math.max(1, Math.floor(data.length / 50000));
    let n = 0;
    for (let i = 0; i < data.length; i += step) {
      sum += data[i] * data[i];
      n++;
    }
    const rms = Math.sqrt(sum / n);
    const energetic = (bpm && bpm > 120) || rms > 0.18;
    if (energetic) return rms > 0.25 ? "energetic" : "uplifting";
    if (rms < 0.07) return "melancholic";
    return "dreamy";
  }

  const MOOD_LABELS = {
    energetic: "Énergique",
    uplifting: "Lumineux",
    dreamy: "Rêveur",
    melancholic: "Mélancolique",
    dark: "Sombre",
  };

  async function analyze(file) {
    const arrayBuf = await file.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = await ctx.decodeAudioData(arrayBuf);
    let bpm = null;
    try {
      bpm = await detectBPM(buffer);
    } catch (e) {
      console.warn("BPM detection failed", e);
    }
    const mood = guessMood(buffer, bpm);
    ctx.close();
    return {
      duration: buffer.duration,
      durationLabel: fmtDuration(buffer.duration),
      bpm,
      mood,
      moodLabel: MOOD_LABELS[mood] || mood,
    };
  }

  return { analyze, fmtDuration, MOOD_LABELS };
})();
