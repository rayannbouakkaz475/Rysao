/* ===========================================================================
   RYSAO TCG — Scanner caméra temps réel + analyse de centrage
   Méthode : on échantillonne une ligne médiane horizontale et verticale dans
   la zone de cadrage (ROI), on calcule la dérivée de luminance pour détecter
   les bords externes (carte/fond) et internes (bordure/illustration), puis on
   en déduit les largeurs de marge et le ratio de centrage.
   100% côté client, aucune image n'est envoyée nulle part.
   =========================================================================== */

const Scanner = (() => {
  let stream = null, raf = null, video = null, canvas = null, ctx = null;
  let onResult = null, running = false;

  // ROI relatif (la carte est censée remplir ~80% du cadre central)
  const ROI = { x: 0.12, y: 0.08, w: 0.76, h: 0.84 };

  async function start(videoEl, canvasEl, cb) {
    video = videoEl; canvas = canvasEl; onResult = cb;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (e) {
      if (onResult) onResult({ error: "no_cam" });
      return false;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    running = true;
    loop();
    return true;
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach((tk) => tk.stop());
    stream = null;
  }

  function loop() {
    if (!running) return;
    if (video.readyState >= 2) {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (vw && vh) {
        canvas.width = vw; canvas.height = vh;
        ctx.drawImage(video, 0, 0, vw, vh);
        try {
          const result = analyze(vw, vh);
          if (onResult) onResult(result);
        } catch (_) { /* frame instable, on saute */ }
      }
    }
    raf = requestAnimationFrame(loop);
  }

  // Luminance d'une ligne de pixels (Uint8ClampedArray RGBA)
  function lumaLine(data) {
    const n = data.length / 4;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
      out[i] = 0.299*r + 0.587*g + 0.114*b;
    }
    return out;
  }

  function smooth(arr, k = 3) {
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      let s = 0, c = 0;
      for (let j = -k; j <= k; j++) { const idx = i+j; if (idx>=0 && idx<arr.length){ s+=arr[idx]; c++; } }
      out[i] = s/c;
    }
    return out;
  }

  // Trouve les bords (pics de dérivée) sur une moitié donnée.
  // dir = +1 : on cherche de l'extérieur vers l'intérieur depuis la gauche/haut
  // Retourne {outer, inner} en index de pixel, ou null si signal trop faible.
  function findBorders(luma, fromLeft) {
    const n = luma.length;
    const deriv = new Float32Array(n);
    for (let i = 1; i < n; i++) deriv[i] = Math.abs(luma[i] - luma[i-1]);
    const d = smooth(deriv, 2);

    // seuil dynamique
    let max = 0; for (let i=0;i<n;i++) if (d[i]>max) max=d[i];
    const thr = Math.max(8, max * 0.35);

    const peaks = [];
    for (let i = 2; i < n-2; i++) {
      if (d[i] > thr && d[i] >= d[i-1] && d[i] >= d[i+1]) {
        peaks.push({ i, v: d[i] });
        i += 3; // éviter doublons collés
      }
    }
    if (peaks.length < 2) return null;
    // On veut les deux premiers pics depuis le bord considéré
    const ordered = fromLeft ? peaks : peaks.slice().reverse();
    return { outer: ordered[0].i, inner: ordered[1].i, strength: max };
  }

  function analyze(vw, vh) {
    const rx = Math.floor(ROI.x * vw), ry = Math.floor(ROI.y * vh);
    const rw = Math.floor(ROI.w * vw), rh = Math.floor(ROI.h * vh);

    // --- Ligne horizontale médiane ---
    const midY = ry + Math.floor(rh / 2);
    const hData = ctx.getImageData(rx, midY, rw, 1).data;
    const hLuma = smooth(lumaLine(hData), 2);
    const leftB = findBorders(hLuma, true);
    const rightB = findBorders(hLuma, false);

    // --- Ligne verticale médiane ---
    const midX = rx + Math.floor(rw / 2);
    const vDataImg = ctx.getImageData(midX, ry, 1, rh).data;
    const vLuma = smooth(lumaLine(vDataImg), 2);
    const topB = findBorders(vLuma, true);
    const botB = findBorders(vLuma, false);

    if (!leftB || !rightB || !topB || !botB) {
      return { aligned: false, quality: 0 };
    }

    // Largeurs de marge (en px ROI)
    const l = Math.abs(leftB.inner - leftB.outer);
    const r = Math.abs(rightB.outer - rightB.inner);
    const tp = Math.abs(topB.inner - topB.outer);
    const bt = Math.abs(botB.outer - botB.inner);

    // Ratios de centrage 0..1 (0.5 = parfait)
    const lrTotal = l + r, tbTotal = tp + bt;
    if (lrTotal < 4 || tbTotal < 4) return { aligned: false, quality: 0.2 };
    const centerLR = l / lrTotal;
    const centerTB = tp / tbTotal;

    // Qualité de détection basée sur force des bords
    const strength = (leftB.strength + rightB.strength + topB.strength + botB.strength) / 4;
    const quality = Math.max(0, Math.min(1, strength / 90));

    // Score de centrage : 1 = parfait, 0 = très décentré
    const devLR = Math.abs(centerLR - 0.5) * 2; // 0..1
    const devTB = Math.abs(centerTB - 0.5) * 2;
    const centeringScore = Math.max(0, 1 - (devLR * 0.55 + devTB * 0.45));

    // Ratio façon PSA, ex "55/45"
    const pctL = Math.round(centerLR * 100), pctR = 100 - pctL;
    const pctT = Math.round(centerTB * 100), pctB = 100 - pctT;

    return {
      aligned: quality > 0.25,
      quality,
      borders: { t: tp, b: bt, l, r },
      centerLR, centerTB,
      centeringScore,
      ratioLR: `${Math.max(pctL,pctR)}/${Math.min(pctL,pctR)}`,
      ratioTB: `${Math.max(pctT,pctB)}/${Math.min(pctT,pctB)}`,
    };
  }

  return { start, stop, ROI };
})();

window.Scanner = Scanner;
