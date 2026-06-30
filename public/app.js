// ============================================================
//  Rysao — logique du studio (frontend)
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const STYLE_EMOJI = {
  concert: "🎤", cinematic: "🎬", anime: "🌸", neon: "🌃",
  nature: "🏔️", abstract: "🌀", retro: "📼",
};

// État global de la session.
const state = {
  config: null,
  step: 0,
  audio: null,            // { duration, bpm, mood, ... }
  styleKey: null,
  mood: null,
  character: { description: "", gender: "none", style: "", referenceImage: null },
  modelKey: null,
  aspectRatio: "16:9",
  durationSec: 5,
  shotCount: 4,
  prompts: [],
  audioFile: null,       // fichier musique (pour le montage)
  audioId: null,         // id renvoyé après upload serveur
  results: {},           // index du plan -> URL vidéo générée
  seed: Math.floor(Math.random() * 1_000_000), // seed partagé -> cohérence
  consistencyMode: "anchor", // anchor | chain | off
};

// ---------- Initialisation ----------
async function init() {
  const cfg = await fetch("/api/config").then((r) => r.json());
  state.config = cfg;
  state.modelKey = cfg.defaultModel;

  // Badge mode démo / réel
  const badge = $("#modeBadge");
  if (cfg.demoMode) {
    badge.textContent = "Mode démo";
    badge.className = "badge demo";
    badge.title = "Aucun crédit Replicate n'est dépensé. Désactive DEMO_MODE dans .env pour générer pour de vrai.";
  } else {
    badge.textContent = cfg.hasToken ? "● Live · Replicate" : "⚠ Clé manquante";
    badge.className = cfg.hasToken ? "badge live" : "badge demo";
  }

  buildStyleGrid(cfg.styles);
  buildMoodChips(cfg.moods);
  buildModelSelect(cfg.models);
  wireNavigation();
  wireAudio();
  wireCharacter();
  wireSettings();
  $("#generateBtn").addEventListener("click", runGeneration);
  $("#assembleBtn").addEventListener("click", assembleFinal);
  wireConsistency();
  $("#genAnchorBtn").addEventListener("click", generateAnchor);
}

// ---------- Cohérence du personnage ----------
const CONSISTENCY_HINTS = {
  anchor: "Ancre : même image de départ + seed fixe pour tous les plans.",
  chain: "Enchaînement : la dernière image d'un plan devient l'image de départ du suivant (continuité fluide, génération séquentielle).",
  off: "Aucune : plans indépendants, sans contrainte de cohérence.",
};
function wireConsistency() {
  $$("#consistencyChips .chip").forEach((c) =>
    c.addEventListener("click", () => {
      state.consistencyMode = c.dataset.mode;
      $$("#consistencyChips .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
      $("#consistencyHint").textContent = CONSISTENCY_HINTS[c.dataset.mode];
    })
  );
}

async function generateAnchor() {
  const btn = $("#genAnchorBtn");
  const old = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Génération du personnage…`;
  try {
    const res = await fetch("/api/anchor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character: state.character,
        styleKey: state.styleKey,
        aspectRatio: "1:1",
        seed: state.seed,
      }),
    }).then((r) => r.json());
    if (res.error) throw new Error(res.error);
    state.character.referenceImage = res.image;
    const img = $("#refPreview");
    img.src = res.image;
    img.classList.remove("hidden");
    $("#refText").classList.add("hidden");
    btn.textContent = res.demo ? "🪄 Régénérer (ancrage démo)" : "🪄 Régénérer le personnage";
  } catch (e) {
    btn.textContent = old;
    alert("Échec de la génération du personnage : " + e.message);
  } finally {
    btn.disabled = false;
  }
}

// ---------- Construction des UI dynamiques ----------
function buildStyleGrid(styles) {
  const grid = $("#styleGrid");
  grid.innerHTML = "";
  styles.forEach((s) => {
    const b = document.createElement("button");
    b.className = "card";
    b.innerHTML = `<span class="emoji">${STYLE_EMOJI[s.key] || "🎞️"}</span><span class="ttl">${s.label}</span>`;
    b.addEventListener("click", () => {
      state.styleKey = s.key;
      $$("#styleGrid .card").forEach((c) => c.classList.remove("active"));
      b.classList.add("active");
      $("#next1").disabled = false;
    });
    grid.appendChild(b);
  });
}

function buildMoodChips(moods) {
  const wrap = $("#moodChips");
  wrap.innerHTML = "";
  moods.forEach((m) => {
    const c = document.createElement("button");
    c.className = "chip";
    c.textContent = m.label;
    c.addEventListener("click", () => {
      state.mood = m.key;
      $$("#moodChips .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
    });
    wrap.appendChild(c);
  });
}

function buildModelSelect(models) {
  const sel = $("#modelSelect");
  sel.innerHTML = "";
  models.forEach((m) => {
    const o = document.createElement("option");
    o.value = m.key;
    o.textContent = m.label;
    if (m.key === state.modelKey) o.selected = true;
    sel.appendChild(o);
  });
  updateModelHint();
  sel.addEventListener("change", () => {
    state.modelKey = sel.value;
    updateModelHint();
  });
}

function currentModel() {
  return state.config.models.find((m) => m.key === state.modelKey);
}

function updateModelHint() {
  const m = currentModel();
  if (!m) return;
  $("#modelHint").textContent =
    `Durée max ${m.maxDurationSec}s par plan · ` +
    (m.supportsReferenceImage
      ? "image de référence supportée (cohérence du personnage)"
      : "pas d'image de référence (texte seul)");
  updateCost();
}

// ---------- Navigation par étapes ----------
function wireNavigation() {
  $$(".step").forEach((s) =>
    s.addEventListener("click", () => goTo(Number(s.dataset.step), true))
  );
  $$("[data-back]").forEach((b) =>
    b.addEventListener("click", () => goTo(state.step - 1))
  );
  $("#next0").addEventListener("click", () => goTo(1));
  $("#next1").addEventListener("click", () => goTo(2));
  $("#next2").addEventListener("click", () => goTo(3));
  $("#next3").addEventListener("click", () => { buildPlan(); goTo(4); });
}

function goTo(step, fromTab = false) {
  if (step < 0 || step > 4) return;
  // Empêche de sauter en avant via les onglets sans audio.
  if (fromTab && step > 0 && !state.audio) return;
  state.step = step;
  $$(".panel").forEach((p) => p.classList.toggle("active", Number(p.dataset.panel) === step));
  $$(".step").forEach((s) => {
    const i = Number(s.dataset.step);
    s.classList.toggle("active", i === step);
    s.classList.toggle("done", i < step);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Étape 1 : audio ----------
function wireAudio() {
  const input = $("#audioInput");
  const dz = $("#dropzone");
  input.addEventListener("change", () => handleAudio(input.files[0]));
  ["dragover", "dragenter"].forEach((e) =>
    dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add("drag"); })
  );
  ["dragleave", "drop"].forEach((e) =>
    dz.addEventListener(e, () => dz.classList.remove("drag"))
  );
  dz.addEventListener("drop", (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer.files[0]) handleAudio(ev.dataTransfer.files[0]);
  });
}

async function handleAudio(file) {
  if (!file) return;
  state.audioFile = file;
  state.audioId = null; // re-upload nécessaire si la musique change
  $("#audioCard").classList.remove("hidden");
  $("#player").src = URL.createObjectURL(file);
  $("#statName").textContent = file.name.length > 16 ? file.name.slice(0, 14) + "…" : file.name;
  $("#statDur").textContent = "…";
  $("#statBpm").textContent = "…";
  $("#statMood").textContent = "Analyse…";
  try {
    const a = await window.RysaoAudio.analyze(file);
    state.audio = a;
    $("#statDur").textContent = a.durationLabel;
    $("#statBpm").textContent = a.bpm ? a.bpm : "—";
    $("#statMood").textContent = a.moodLabel;
    // Pré-sélectionne l'ambiance détectée.
    if (!state.mood) {
      state.mood = a.mood;
      $$("#moodChips .chip").forEach((c) =>
        c.classList.toggle("active", c.textContent === a.moodLabel)
      );
    }
    $("#next0").disabled = false;
  } catch (e) {
    console.error(e);
    $("#statMood").textContent = "Erreur";
    // On autorise quand même de continuer sans analyse.
    state.audio = { duration: 0, bpm: null, mood: "energetic" };
    $("#next0").disabled = false;
  }
}

// ---------- Étape 3 : personnage ----------
function wireCharacter() {
  $("#charDesc").addEventListener("input", (e) => (state.character.description = e.target.value));
  $("#charGender").addEventListener("change", (e) => (state.character.gender = e.target.value));
  $("#charStyle").addEventListener("input", (e) => (state.character.style = e.target.value));

  const refInput = $("#refInput");
  refInput.addEventListener("change", () => {
    const file = refInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.character.referenceImage = reader.result; // data URI
      const img = $("#refPreview");
      img.src = reader.result;
      img.classList.remove("hidden");
      $("#refText").classList.add("hidden");
    };
    reader.readAsDataURL(file);
  });
}

// ---------- Étape 4 : réglages ----------
function wireSettings() {
  $$("#ratioChips .chip").forEach((c) =>
    c.addEventListener("click", () => {
      state.aspectRatio = c.dataset.ratio;
      $$("#ratioChips .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
    })
  );
  $$("#durChips .chip").forEach((c) =>
    c.addEventListener("click", () => {
      state.durationSec = Number(c.dataset.dur);
      $$("#durChips .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
    })
  );
  const range = $("#shotRange");
  range.addEventListener("input", () => {
    state.shotCount = Number(range.value);
    $("#shotVal").textContent = range.value;
    updateCost();
  });
  updateCost();
}

function updateCost() {
  const total = state.shotCount * state.durationSec;
  const hint = $("#costHint");
  if (!hint) return;
  if (state.config?.demoMode) {
    hint.textContent = `≈ ${total}s de vidéo au total · Mode démo : génération simulée, 0 € dépensé.`;
  } else {
    hint.textContent = `≈ ${total}s de vidéo au total · le coût dépend du modèle Replicate choisi (souvent 0,2–0,7 $/s).`;
  }
}

// ---------- Étape 5 : plan + génération ----------
async function buildPlan() {
  const body = {
    styleKey: state.styleKey,
    mood: state.mood,
    character: state.character,
    shotCount: state.shotCount,
    audio: state.audio,
  };
  const { prompts } = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
  state.prompts = prompts || [];
  renderShots();
}

function renderShots() {
  const list = $("#shotList");
  list.innerHTML = "";
  state.prompts.forEach((p) => {
    const div = document.createElement("div");
    div.className = "shot";
    div.id = `shot-${p.index}`;
    div.innerHTML = `
      <div class="shot-head">
        <b>Plan ${p.index + 1}</b>
        <span class="status" data-status>En attente</span>
      </div>
      <div class="shot-prompt">${p.prompt}</div>
      <div class="shot-video"></div>`;
    list.appendChild(div);
  });
}

async function runGeneration() {
  const btn = $("#generateBtn");
  btn.disabled = true;
  btn.textContent = "Génération en cours…";
  state.results = {};

  if (state.consistencyMode === "chain") {
    // Séquentiel : la dernière image d'un plan amorce le suivant.
    let startImage = state.character.referenceImage || null;
    for (const p of state.prompts) {
      const url = await generateShot(p, startImage);
      if (url) {
        const frame = await fetchLastFrame(url);
        if (frame) startImage = frame; // sinon on garde l'ancrage
      }
    }
  } else {
    // Ancre / Aucune : plans en parallèle (image de départ commune).
    await Promise.all(state.prompts.map((p) => generateShot(p)));
  }

  btn.disabled = false;
  btn.textContent = "↻ Relancer la génération";

  // Montage possible dès qu'au moins un plan a réussi.
  const ok = Object.keys(state.results).length;
  const zone = $("#assembleZone");
  if (ok > 0 && state.config.canAssemble) {
    zone.classList.remove("hidden");
  } else if (ok > 0 && !state.config.canAssemble) {
    zone.classList.remove("hidden");
    $("#assembleBtn").disabled = true;
    $("#assembleBtn").textContent = "Montage indisponible (FFmpeg absent)";
  }
}

// ---------- Montage final ----------
async function uploadAudioIfNeeded() {
  if (state.audioId || !state.audioFile) return state.audioId;
  const res = await fetch("/api/upload-audio", {
    method: "POST",
    headers: { "Content-Type": state.audioFile.type || "audio/mpeg" },
    body: state.audioFile,
  }).then((r) => r.json());
  if (res.error) throw new Error(res.error);
  state.audioId = res.audioId;
  return state.audioId;
}

async function assembleFinal() {
  const btn = $("#assembleBtn");
  const status = $("#assembleStatus");
  const out = $("#finalVideo");
  btn.disabled = true;
  out.innerHTML = "";
  status.classList.remove("hidden");
  status.innerHTML = `<span class="spinner"></span>Préparation…`;

  try {
    // Plans réussis, dans l'ordre.
    const shots = state.prompts
      .filter((p) => state.results[p.index])
      .map((p) => ({ url: state.results[p.index], durationSec: state.durationSec }));
    if (!shots.length) throw new Error("aucun plan réussi à assembler");

    if (state.audioFile) {
      status.innerHTML = `<span class="spinner"></span>Envoi de la musique…`;
      await uploadAudioIfNeeded();
    }

    status.innerHTML = `<span class="spinner"></span>Montage en cours (téléchargement, découpe sur le beat, encodage)…`;
    const res = await fetch("/api/assemble", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shots,
        audioId: state.audioId,
        bpm: state.audio?.bpm || null,
        aspectRatio: state.aspectRatio,
        snapToBeat: $("#snapBeat").checked,
      }),
    }).then((r) => r.json());

    if (res.error) throw new Error(res.error);

    status.innerHTML = `✅ Clip monté · ${res.durationSec}s · ${shots.length} plans`;
    out.innerHTML = `
      <video src="${res.url}" controls autoplay loop playsinline></video>
      <a class="dl" href="${res.url}" download>⬇️ Télécharger le clip (.mp4)</a>`;
  } catch (e) {
    status.innerHTML = `<span style="color:var(--brand2)">Échec du montage : ${e.message}</span>`;
  } finally {
    btn.disabled = false;
  }
}

// startImageOverride : image de départ imposée (mode enchaînement).
// Retourne l'URL de la vidéo produite (ou undefined si échec).
async function generateShot(p, startImageOverride) {
  const shot = $(`#shot-${p.index}`);
  const statusEl = shot.querySelector("[data-status]");
  const videoWrap = shot.querySelector(".shot-video");
  setStatus(statusEl, "processing", "Envoi…");
  videoWrap.innerHTML = "";

  // Mode "off" : pas d'image de départ ni de seed partagé.
  const useConsistency = state.consistencyMode !== "off";
  const referenceImage =
    startImageOverride !== undefined
      ? startImageOverride
      : useConsistency
        ? state.character.referenceImage
        : null;

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelKey: state.modelKey,
        prompt: p.prompt,
        negativePrompt: p.negativePrompt,
        durationSec: state.durationSec,
        aspectRatio: state.aspectRatio,
        referenceImage,
        seed: useConsistency ? state.seed : null,
      }),
    }).then((r) => r.json());

    if (res.error) throw new Error(res.error);

    if (res.status === "succeeded" && res.output) {
      return showVideo(statusEl, videoWrap, res.output, res.demo, p.index);
    }
    // Sinon on poll l'état.
    return await pollStatus(res.id, statusEl, videoWrap, p.index);
  } catch (e) {
    setStatus(statusEl, "failed", "Échec");
    videoWrap.innerHTML = `<small class="hint">${e.message}</small>`;
  }
}

// Récupère la dernière image d'un plan généré (mode enchaînement).
async function fetchLastFrame(videoUrl) {
  try {
    const res = await fetch("/api/last-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl }),
    }).then((r) => r.json());
    return res.image || null;
  } catch {
    return null;
  }
}

function pollStatus(id, statusEl, videoWrap, index) {
  return new Promise((resolve) => {
    setStatus(statusEl, "processing", "Génération…");
    const timer = setInterval(async () => {
      try {
        const s = await fetch(`/api/status/${id}`).then((r) => r.json());
        if (s.status === "succeeded") {
          clearInterval(timer);
          resolve(showVideo(statusEl, videoWrap, s.output, s.demo, index));
        } else if (s.status === "failed" || s.status === "canceled") {
          clearInterval(timer);
          setStatus(statusEl, "failed", "Échec");
          videoWrap.innerHTML = `<small class="hint">${s.error || "génération échouée"}</small>`;
          resolve();
        }
      } catch (e) {
        clearInterval(timer);
        setStatus(statusEl, "failed", "Erreur réseau");
        resolve();
      }
    }, 3000);
  });
}

function showVideo(statusEl, videoWrap, output, demo, index) {
  const url = Array.isArray(output) ? output[0] : output;
  setStatus(statusEl, "succeeded", demo ? "Démo ✓" : "Prêt ✓");
  videoWrap.innerHTML = `<video src="${url}" controls loop muted playsinline></video>`;
  if (typeof index === "number") state.results[index] = url;
  return url;
}

function setStatus(el, cls, text) {
  el.className = `status ${cls}`;
  el.innerHTML =
    cls === "processing" ? `<span class="spinner"></span>${text}` : text;
}

init();
