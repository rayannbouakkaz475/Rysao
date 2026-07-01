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
  idea: "",              // texte libre : ce que l'utilisateur veut voir
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
  lyrics: null,          // segments transcrits [{start,end,text}]
  useLyrics: false,      // construire les plans à partir des paroles
  lastClipFile: null,    // nom du dernier clip monté (pour l'upscale)
  upscaleMethod: "fast", // fast | ai
  projectId: null,       // id du projet courant (si sauvegardé)
  projectName: "",       // nom du projet courant
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
  buildPresetGrid(cfg.characterPresets || []);
  buildModelSelect(cfg.models);
  wireNavigation();
  wireAudio();
  wireCharacter();
  wireSettings();
  $("#generateBtn").addEventListener("click", runGeneration);
  $("#assembleBtn").addEventListener("click", assembleFinal);
  wireConsistency();
  $("#genAnchorBtn").addEventListener("click", generateAnchor);
  $("#transcribeBtn").addEventListener("click", transcribeLyrics);
  $("#useLyrics").addEventListener("change", (e) => (state.useLyrics = e.target.checked));
  wireUpscale();
  $("#ideaInput").addEventListener("input", (e) => (state.idea = e.target.value));
  wireProjects();
}

// ---------- Sauvegarde des projets ----------
function wireProjects() {
  $("#projectsBtn").addEventListener("click", openProjects);
  $("#projectsClose").addEventListener("click", () => $("#projectsModal").classList.add("hidden"));
  $("#projectsModal").addEventListener("click", (e) => {
    if (e.target.id === "projectsModal") $("#projectsModal").classList.add("hidden");
  });
  $("#saveProjectBtn").addEventListener("click", saveProject);
  $("#newProjectBtn").addEventListener("click", newProject);
}

async function openProjects() {
  $("#projectsModal").classList.remove("hidden");
  await refreshProjects();
}

async function refreshProjects() {
  const list = $("#projectsList");
  list.innerHTML = `<div class="projects-empty">Chargement…</div>`;
  try {
    const { projects } = await fetch("/api/projects").then((r) => r.json());
    if (!projects?.length) {
      list.innerHTML = `<div class="projects-empty">Aucun projet sauvegardé pour l'instant.</div>`;
      return;
    }
    list.innerHTML = "";
    projects.forEach((p) => {
      const div = document.createElement("div");
      div.className = "proj";
      const date = p.updatedAt ? new Date(p.updatedAt).toLocaleString("fr-FR") : "";
      div.innerHTML = `
        <div class="meta">
          <b>${p.name}</b>
          <small>${p.styleKey || "—"} · ${p.shots} plan(s) · ${date}</small>
        </div>
        <div class="proj-btns">
          <button class="load" data-id="${p.id}">Charger</button>
          <button class="del" data-id="${p.id}">🗑</button>
        </div>`;
      div.querySelector(".load").addEventListener("click", () => loadProject(p.id));
      div.querySelector(".del").addEventListener("click", () => deleteProject(p.id, p.name));
      list.appendChild(div);
    });
  } catch (e) {
    list.innerHTML = `<div class="projects-empty">Erreur : ${e.message}</div>`;
  }
}

function collectProject(name) {
  return {
    id: state.projectId,
    name,
    idea: state.idea,
    styleKey: state.styleKey,
    mood: state.mood,
    character: state.character,
    consistencyMode: state.consistencyMode,
    seed: state.seed,
    modelKey: state.modelKey,
    aspectRatio: state.aspectRatio,
    durationSec: state.durationSec,
    shotCount: state.shotCount,
    audio: state.audio,
    audioId: state.audioId,
    audioName: state.audioFile?.name || state.projectAudioName || "",
    lyrics: state.lyrics,
    useLyrics: state.useLyrics,
    prompts: state.prompts,
    results: state.results,
    lastClipFile: state.lastClipFile,
  };
}

async function saveProject() {
  const suggested = state.projectName || (state.idea ? state.idea.slice(0, 40) : "Mon clip");
  const name = prompt("Nom du projet :", suggested);
  if (name === null) return;
  // Si la musique n'est pas encore uploadée, on l'envoie pour la réutiliser plus tard.
  try {
    if (state.audioFile && !state.audioId) await uploadAudioIfNeeded();
  } catch {}
  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collectProject(name)),
    }).then((r) => r.json());
    if (res.error) throw new Error(res.error);
    state.projectId = res.id;
    state.projectName = res.name;
    $("#projectName").textContent = "💾 " + res.name;
    await refreshProjects();
  } catch (e) {
    alert("Échec de la sauvegarde : " + e.message);
  }
}

function newProject() {
  if (!confirm("Démarrer un nouveau projet ? Les choix non sauvegardés seront perdus.")) return;
  location.reload();
}

async function deleteProject(id, name) {
  if (!confirm(`Supprimer le projet « ${name} » ?`)) return;
  try {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (state.projectId === id) {
      state.projectId = null;
      state.projectName = "";
      $("#projectName").textContent = "";
    }
    await refreshProjects();
  } catch (e) {
    alert("Échec de la suppression : " + e.message);
  }
}

async function loadProject(id) {
  try {
    const p = await fetch(`/api/projects/${id}`).then((r) => r.json());
    if (p.error) throw new Error(p.error);
    applyProject(p);
    $("#projectsModal").classList.add("hidden");
  } catch (e) {
    alert("Échec du chargement : " + e.message);
  }
}

// Active le chip/carte dont l'attribut `attr` vaut `val`.
function activate(containerSel, attr, val) {
  $$(`${containerSel} [data-${attr}]`).forEach((el) =>
    el.classList.toggle("active", el.dataset[attr] === String(val))
  );
}

// Restaure l'état complet + l'interface depuis un projet sauvegardé.
function applyProject(p) {
  // --- État ---
  state.projectId = p.id;
  state.projectName = p.name;
  state.idea = p.idea || "";
  state.styleKey = p.styleKey || null;
  state.mood = p.mood || null;
  state.character = {
    description: p.character?.description || "",
    gender: p.character?.gender || "none",
    style: p.character?.style || "",
    referenceImage: p.character?.referenceImage || null,
  };
  state.consistencyMode = p.consistencyMode || "anchor";
  state.seed = p.seed || state.seed;
  state.modelKey = p.modelKey || state.config.defaultModel;
  state.aspectRatio = p.aspectRatio || "16:9";
  state.durationSec = p.durationSec || 5;
  state.shotCount = p.shotCount || 4;
  state.audio = p.audio || null;
  state.audioId = p.audioId || null;
  state.audioFile = null; // le fichier n'est pas restauré dans l'input
  state.projectAudioName = p.audioName || "";
  state.lyrics = p.lyrics || null;
  state.useLyrics = Boolean(p.useLyrics);
  state.prompts = p.prompts || [];
  state.results = p.results || {};
  state.lastClipFile = p.lastClipFile || null;

  // --- UI : en-tête ---
  $("#projectName").textContent = "💾 " + p.name;

  // --- Étape 1 : audio (métadonnées sauvegardées) ---
  if (state.audio) {
    $("#audioCard").classList.remove("hidden");
    $("#statName").textContent = (state.projectAudioName || "musique").slice(0, 16);
    $("#statDur").textContent = state.audio.durationLabel || "—";
    $("#statBpm").textContent = state.audio.bpm || "—";
    $("#statMood").textContent = state.audio.moodLabel || "—";
    $("#next0").disabled = false;
  }

  // --- Étape 2 : idée + style + ambiance ---
  $("#ideaInput").value = state.idea;
  if (state.styleKey) {
    activate("#styleGrid", "key", state.styleKey);
    $("#next1").disabled = false;
  }
  if (state.mood) activate("#moodChips", "key", state.mood);

  // --- Étape 3 : personnage + cohérence ---
  $("#charDesc").value = state.character.description;
  $("#charGender").value = state.character.gender;
  $("#charStyle").value = state.character.style;
  syncPresetSelection();
  if (state.character.referenceImage) {
    const img = $("#refPreview");
    img.src = state.character.referenceImage;
    img.classList.remove("hidden");
    $("#refText").classList.add("hidden");
  }
  activate("#consistencyChips", "mode", state.consistencyMode);
  $("#consistencyHint").textContent = CONSISTENCY_HINTS[state.consistencyMode];

  // --- Étape 4 : réglages ---
  $("#modelSelect").value = state.modelKey;
  updateModelHint();
  activate("#ratioChips", "ratio", state.aspectRatio);
  activate("#durChips", "dur", state.durationSec);
  $("#shotRange").value = state.shotCount;
  $("#shotVal").textContent = state.shotCount;
  updateCost();

  // --- Paroles ---
  if (state.lyrics?.length) {
    renderLyrics(state.lyrics, false);
    $("#useLyricsRow").style.display = "flex";
    $("#useLyrics").checked = state.useLyrics;
  }

  // --- Étape 5 : plans + résultats déjà générés ---
  if (state.prompts.length) {
    renderShots();
    state.prompts.forEach((p2) => {
      const url = state.results[p2.index];
      if (!url) return;
      const shot = $(`#shot-${p2.index}`);
      shot.querySelector("[data-status]").className = "status succeeded";
      shot.querySelector("[data-status]").textContent = "Restauré ✓";
      const vw = shot.querySelector(".shot-video");
      vw.innerHTML = `<video src="${url}" controls loop muted playsinline></video>`;
      addLipsyncButton(vw, p2.index);
    });
    // Montage / upscale si au moins un plan présent.
    if (Object.keys(state.results).length && state.config.canAssemble) {
      $("#assembleZone").classList.remove("hidden");
    }
    if (state.lastClipFile) {
      $("#finalVideo").innerHTML = `
        <video src="/outputs/${state.lastClipFile}" controls loop playsinline></video>
        <a class="dl" href="/outputs/${state.lastClipFile}" download>⬇️ Télécharger le clip (.mp4)</a>`;
      $("#upscaleZone").classList.remove("hidden");
    }
  }

  goTo(0, false);
  alert(`Projet « ${p.name} » chargé.`);
}

// ---------- Upscale 4K ----------
const UPSCALE_HINTS = {
  fast: "Rapide : mise à l'échelle 4K locale (FFmpeg), gratuite et instantanée.",
  ai: "IA : super-résolution Real-ESRGAN via Replicate (clé requise, payant, plus long). En mode démo, bascule sur la version rapide.",
};
function wireUpscale() {
  $$("#upscaleMethod .chip").forEach((c) =>
    c.addEventListener("click", () => {
      state.upscaleMethod = c.dataset.method;
      $$("#upscaleMethod .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
      $("#upscaleHint").textContent = UPSCALE_HINTS[c.dataset.method];
    })
  );
  $("#upscaleBtn").addEventListener("click", runUpscale);
}

async function runUpscale() {
  if (!state.lastClipFile) { alert("Monte d'abord le clip final."); return; }
  const btn = $("#upscaleBtn");
  const status = $("#upscaleStatus");
  const out = $("#upscaleVideo");
  btn.disabled = true;
  out.innerHTML = "";
  status.classList.remove("hidden");
  status.innerHTML = `<span class="spinner"></span>${
    state.upscaleMethod === "ai" ? "Upscale IA en cours (upload + Real-ESRGAN)…" : "Upscale 4K en cours…"
  }`;
  try {
    const res = await fetch("/api/upscale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: state.lastClipFile,
        aspectRatio: state.aspectRatio,
        method: state.upscaleMethod,
      }),
    }).then((r) => r.json());
    if (res.error) throw new Error(res.error);
    const label =
      res.method === "ai" ? "4K · IA Real-ESRGAN"
      : res.method === "fast-fallback" ? "4K · rapide (démo : IA indisponible)"
      : `4K · rapide${res.width ? ` · ${res.width}×${res.height}` : ""}`;
    status.innerHTML = `✅ ${label}`;
    out.innerHTML = `
      <video src="${res.url}" controls loop playsinline></video>
      <a class="dl" href="${res.url}" download>⬇️ Télécharger la version 4K (.mp4)</a>`;
  } catch (e) {
    status.innerHTML = `<span style="color:var(--brand2)">Échec de l'upscale : ${e.message}</span>`;
  } finally {
    btn.disabled = false;
  }
}

// ---------- Transcription des paroles (Whisper) ----------
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
async function transcribeLyrics() {
  const btn = $("#transcribeBtn");
  const old = btn.textContent;
  if (!state.audioFile) { alert("Importe d'abord une musique (étape 1)."); return; }
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Transcription…`;
  try {
    await uploadAudioIfNeeded();
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioId: state.audioId }),
    }).then((r) => r.json());
    if (res.error) throw new Error(res.error);
    state.lyrics = res.segments;
    renderLyrics(res.segments, res.demo);
    $("#useLyricsRow").style.display = "flex";
    $("#useLyrics").checked = true;
    state.useLyrics = true;
    btn.textContent = res.demo ? "📝 Re-transcrire (démo)" : "📝 Re-transcrire";
  } catch (e) {
    btn.textContent = old;
    alert("Échec de la transcription : " + e.message);
  } finally {
    btn.disabled = false;
  }
}
function renderLyrics(segments, demo) {
  const wrap = $("#lyricsPreview");
  const head = demo ? `<small class="hint">Paroles d'exemple (mode démo).</small>` : "";
  wrap.innerHTML =
    head +
    segments
      .map((s) => `<div class="line"><b>${fmtTime(s.start)}</b><span>${s.text}</span></div>`)
      .join("");
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
    b.dataset.key = s.key;
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
    c.dataset.key = m.key;
    c.textContent = m.label;
    c.addEventListener("click", () => {
      state.mood = m.key;
      $$("#moodChips .chip").forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
    });
    wrap.appendChild(c);
  });
}

function buildPresetGrid(presets) {
  const grid = $("#presetGrid");
  if (!grid) return;
  grid.innerHTML = "";
  presets.forEach((p) => {
    const b = document.createElement("button");
    b.className = "preset";
    b.dataset.key = p.key;
    b.type = "button";
    b.innerHTML = `<span class="pe">${p.emoji}</span><span>${p.label}</span>`;
    b.addEventListener("click", () => {
      // Bascule : reclic = désélection.
      const wasActive = b.classList.contains("active");
      $$("#presetGrid .preset").forEach((x) => x.classList.remove("active"));
      if (wasActive) {
        state.character.description = "";
        $("#charDesc").value = "";
        return;
      }
      b.classList.add("active");
      state.character.description = p.description;
      state.character.gender = "none"; // le fruit EST le personnage
      $("#charDesc").value = p.description;
      $("#charGender").value = "none";
    });
    grid.appendChild(b);
  });
}

// Met en surbrillance le préréglage dont la description correspond
// à la description courante (ou aucun si édition libre).
function syncPresetSelection() {
  const presets = state.config?.characterPresets || [];
  const match = presets.find((p) => p.description === state.character.description);
  $$("#presetGrid .preset").forEach((el) =>
    el.classList.toggle("active", !!match && el.dataset.key === match.key)
  );
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
  $("#charDesc").addEventListener("input", (e) => {
    state.character.description = e.target.value;
    // Édition manuelle -> on désélectionne le préréglage.
    syncPresetSelection();
  });
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
    idea: state.idea,
    mood: state.mood,
    character: state.character,
    shotCount: state.shotCount,
    audio: state.audio,
    useLyrics: state.useLyrics,
    lyrics: state.useLyrics ? state.lyrics : null,
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
    const lyric = p.lyric ? `<div class="shot-lyric">🎤 « ${p.lyric} »</div>` : "";
    div.innerHTML = `
      <div class="shot-head">
        <b>Plan ${p.index + 1}${p.durationSec ? ` · ${p.durationSec}s` : ""}</b>
        <span class="status" data-status>En attente</span>
      </div>
      ${lyric}
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
      .map((p) => ({ url: state.results[p.index], durationSec: p.durationSec || state.durationSec }));
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

    // Le clip monté peut maintenant être passé en 4K.
    state.lastClipFile = res.url.split("/").pop();
    const uz = $("#upscaleZone");
    uz.classList.remove("hidden");
    $("#upscaleStatus").classList.add("hidden");
    $("#upscaleVideo").innerHTML = "";
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
        durationSec: p.durationSec || state.durationSec,
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
  if (typeof index === "number") {
    state.results[index] = url;
    addLipsyncButton(videoWrap, index);
  }
  return url;
}

// Ajoute le bouton "Faire chanter" (lip-sync) sous une vidéo de plan.
function addLipsyncButton(videoWrap, index) {
  const btn = document.createElement("button");
  btn.className = "btn ghost btn-sm lipsync-btn";
  btn.textContent = "🎤 Faire chanter (lip-sync)";
  btn.addEventListener("click", () => lipSyncShot(index));
  videoWrap.appendChild(btn);
}

async function lipSyncShot(index) {
  const p = state.prompts.find((x) => x.index === index);
  const url = state.results[index];
  if (!p || !url) return;
  const shot = $(`#shot-${index}`);
  const statusEl = shot.querySelector("[data-status]");
  const btn = shot.querySelector(".lipsync-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Synchro des lèvres…`; }
  setStatus(statusEl, "processing", "Lip-sync…");
  try {
    if (state.audioFile && !state.audioId) await uploadAudioIfNeeded();
    if (!state.audioId) throw new Error("ajoute une musique (étape 1) avant le lip-sync");
    const res = await fetch("/api/lipsync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoUrl: url,
        audioId: state.audioId,
        startSec: p.startSec || 0,
        durationSec: p.durationSec || state.durationSec,
      }),
    }).then((r) => r.json());
    if (res.error) throw new Error(res.error);
    showVideo(statusEl, shot.querySelector(".shot-video"), res.url, false, index);
    if (res.demo) setStatus(statusEl, "succeeded", "Démo (pas de vrai lip-sync)");
    else setStatus(statusEl, "succeeded", "🎤 Synchronisé ✓");
  } catch (e) {
    setStatus(statusEl, "failed", "Lip-sync échoué");
    if (btn) { btn.disabled = false; btn.textContent = "🎤 Réessayer le lip-sync"; }
    alert("Lip-sync : " + e.message);
  }
}

function setStatus(el, cls, text) {
  el.className = `status ${cls}`;
  el.innerHTML =
    cls === "processing" ? `<span class="spinner"></span>${text}` : text;
}

init();
