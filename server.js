// ============================================================
//  Rysao — AI Music Video  |  Serveur Express + Replicate
// ============================================================
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { writeFile, readFile, readdir, unlink } from "node:fs/promises";
import { createRequire } from "node:module";

import { getModel, getImageModel, UPSCALE_MODEL, publicModelList } from "./models.js";
import {
  buildPrompts, buildPromptsFromLyrics, buildAnchorPrompt,
  publicStyleList, publicMoodList, publicCharacterPresets,
} from "./promptBuilder.js";
import {
  assembleClip, extractLastFrame, upscaleTo4K, ffmpegWorks,
} from "./assemble.js";
import { basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// --- Chargement minimal du .env (sans dépendance externe) ---
function loadEnv() {
  const path = join(__dirname, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = (m[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnv();

const PORT = process.env.PORT || 3000;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "kling-2.1";
const DEMO_MODE = String(process.env.DEMO_MODE || "true").toLowerCase() === "true";
const REPLICATE_BASE = "https://api.replicate.com/v1";

// Vidéo d'exemple renvoyée en mode démo (libre de droits).
const DEMO_VIDEO =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

// Dossiers de travail : musiques uploadées + clips montés.
const WORK_DIR = join(__dirname, ".work");
const UPLOAD_DIR = join(WORK_DIR, "uploads");
const OUTPUT_DIR = join(WORK_DIR, "outputs");
const PROJECTS_DIR = join(WORK_DIR, "projects");
for (const d of [WORK_DIR, UPLOAD_DIR, OUTPUT_DIR, PROJECTS_DIR])
  mkdirSync(d, { recursive: true });

// Résolution du binaire FFmpeg : env > ffmpeg-static > système.
let FFMPEG_PATH = null;
async function resolveFfmpeg() {
  const candidates = [process.env.FFMPEG_PATH];
  try { candidates.push(require("ffmpeg-static")); } catch {}
  candidates.push("ffmpeg");
  for (const c of candidates) {
    if (c && (await ffmpegWorks(c))) return c;
  }
  return null;
}

const app = express();
app.use(express.json({ limit: "25mb" })); // large pour accepter une image de référence en data URI
app.use(express.static(join(__dirname, "public")));
app.use("/outputs", express.static(OUTPUT_DIR)); // clips montés téléchargeables

// --- Config exposée au frontend ---
app.get("/api/config", (req, res) => {
  res.json({
    demoMode: DEMO_MODE,
    hasToken: Boolean(REPLICATE_API_TOKEN),
    defaultModel: DEFAULT_MODEL,
    models: publicModelList(),
    styles: publicStyleList(),
    moods: publicMoodList(),
    characterPresets: publicCharacterPresets(),
    canAssemble: Boolean(FFMPEG_PATH),
  });
});

// --- Helper Replicate ---
async function replicate(path, options = {}) {
  const res = await fetch(`${REPLICATE_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.detail || body?.title || `Replicate HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}

// --- Construire la liste des prompts (preview, sans générer) ---
app.post("/api/plan", (req, res) => {
  try {
    const body = req.body || {};
    const prompts =
      body.useLyrics && Array.isArray(body.lyrics) && body.lyrics.length
        ? buildPromptsFromLyrics(body, body.lyrics)
        : buildPrompts(body);
    res.json({ prompts });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- Lancer la génération d'UN plan ---
//  Body attendu :
//   { modelKey, prompt, negativePrompt, durationSec,
//     aspectRatio, referenceImage, seed }
app.post("/api/generate", async (req, res) => {
  const {
    modelKey = DEFAULT_MODEL,
    prompt,
    negativePrompt = "",
    durationSec = 5,
    aspectRatio = "16:9",
    referenceImage = null,
    seed = null,
  } = req.body || {};

  if (!prompt) return res.status(400).json({ error: "prompt manquant" });

  const model = getModel(modelKey);
  if (!model) return res.status(400).json({ error: `modèle inconnu : ${modelKey}` });

  // Mode démo : pas d'appel API, on simule une prédiction terminée.
  if (DEMO_MODE) {
    return res.json({
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "succeeded",
      demo: true,
      output: DEMO_VIDEO,
      prompt,
    });
  }

  if (!REPLICATE_API_TOKEN) {
    return res.status(400).json({
      error:
        "REPLICATE_API_TOKEN absent. Ajoute ta clé dans .env ou laisse DEMO_MODE=true.",
    });
  }

  try {
    const input = model.buildInput({
      prompt,
      negativePrompt,
      durationSec,
      aspectRatio,
      referenceImage: model.supportsReferenceImage ? referenceImage : null,
      seed: model.supportsSeed && seed != null ? Number(seed) : null,
    });
    const prediction = await replicate(
      `/models/${model.owner}/${model.name}/predictions`,
      { method: "POST", body: JSON.stringify({ input }) }
    );
    res.json({
      id: prediction.id,
      status: prediction.status,
      output: prediction.output || null,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// --- Suivre l'état d'une prédiction ---
app.get("/api/status/:id", async (req, res) => {
  const { id } = req.params;

  if (id.startsWith("demo-") || DEMO_MODE) {
    return res.json({ id, status: "succeeded", output: DEMO_VIDEO, demo: true });
  }

  if (!REPLICATE_API_TOKEN) {
    return res.status(400).json({ error: "REPLICATE_API_TOKEN absent." });
  }

  try {
    const p = await replicate(`/predictions/${id}`);
    res.json({
      id: p.id,
      status: p.status, // starting | processing | succeeded | failed | canceled
      output: p.output || null,
      error: p.error || null,
      logs: p.logs ? String(p.logs).split("\n").slice(-5).join("\n") : null,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// --- Image d'ancrage du personnage (cohérence) ---
//  Génère un portrait de référence réutilisé comme image de départ
//  de tous les plans -> même visage / look partout.
//  Body : { character, styleKey, aspectRatio, seed }
function placeholderAnchor(character) {
  const name = (character?.description || character?.gender || "Personnage").slice(0, 28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/>
    </linearGradient></defs>
    <rect width="512" height="512" fill="url(#g)"/>
    <circle cx="256" cy="205" r="92" fill="#ffffff22"/>
    <rect x="140" y="320" width="232" height="150" rx="40" fill="#ffffff22"/>
    <text x="256" y="492" font-family="sans-serif" font-size="22" fill="#fff"
      text-anchor="middle">${name.replace(/[<>&]/g, "")}</text>
    <text x="256" y="40" font-family="sans-serif" font-size="18" fill="#ffffffaa"
      text-anchor="middle">ancrage (démo)</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

app.post("/api/anchor", async (req, res) => {
  const { character, styleKey, aspectRatio = "1:1", seed = null } = req.body || {};
  const { prompt } = buildAnchorPrompt(character || {}, styleKey);

  if (DEMO_MODE) {
    return res.json({ image: placeholderAnchor(character), demo: true, prompt });
  }
  if (!REPLICATE_API_TOKEN) {
    return res.status(400).json({ error: "REPLICATE_API_TOKEN absent." });
  }
  try {
    const im = getImageModel("flux-schnell");
    const input = im.buildInput({ prompt, aspectRatio, seed: seed != null ? Number(seed) : null });
    // Prefer: wait -> Replicate renvoie directement le résultat (modèle rapide).
    const p = await replicate(`/models/${im.owner}/${im.name}/predictions`, {
      method: "POST",
      headers: { Prefer: "wait" },
      body: JSON.stringify({ input }),
    });
    let out = p.output;
    // Si pas encore prêt, on poll quelques secondes.
    let tries = 0;
    while (!out && p.id && tries < 20) {
      await new Promise((r) => setTimeout(r, 1500));
      const s = await replicate(`/predictions/${p.id}`);
      if (s.status === "succeeded") out = s.output;
      else if (s.status === "failed") throw new Error(s.error || "génération d'image échouée");
      tries++;
    }
    const image = Array.isArray(out) ? out[0] : out;
    if (!image) throw new Error("aucune image générée");
    res.json({ image, prompt });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// --- Dernière image d'un plan (mode enchaînement) ---
//  Body : { videoUrl } -> { image: dataUri }
app.post("/api/last-frame", async (req, res) => {
  const { videoUrl } = req.body || {};
  if (!videoUrl) return res.status(400).json({ error: "videoUrl manquant" });
  // En démo, on évite de télécharger la grosse vidéo d'exemple :
  // le mode enchaînement retombe alors sur l'image d'ancrage.
  if (DEMO_MODE) return res.json({ image: null, demo: true });
  if (!FFMPEG_PATH) return res.status(503).json({ error: "FFmpeg indisponible." });
  try {
    const image = await extractLastFrame(videoUrl, {
      ffmpegPath: FFMPEG_PATH,
      workDir: WORK_DIR,
    });
    res.json({ image });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Transcription des paroles (Whisper via Replicate) ---
//  Body : { audioId } -> { segments:[{start,end,text}], language }
const WHISPER = { owner: "openai", name: "whisper" };
const MIME_BY_EXT = {
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4",
  aac: "audio/aac", ogg: "audio/ogg", flac: "audio/flac",
};
// Normalise les différents formats de sortie Whisper en segments simples.
function normalizeSegments(output) {
  const raw =
    output?.segments ||
    output?.chunks ||
    (Array.isArray(output) ? output : []) ||
    [];
  return raw
    .map((s) => {
      const start = s.start ?? s.timestamp?.[0] ?? 0;
      const end = s.end ?? s.timestamp?.[1] ?? start;
      const text = (s.text || s.transcription || "").trim();
      return { start: Number(start) || 0, end: Number(end) || 0, text };
    })
    .filter((s) => s.text);
}

const DEMO_LYRICS = [
  { start: 0, end: 4, text: "Lumières qui s'allument dans la nuit" },
  { start: 4, end: 8, text: "On danse jusqu'au lever du jour" },
  { start: 8, end: 12, text: "Le rythme nous emporte plus haut" },
  { start: 12, end: 16, text: "Rien ne peut nous arrêter ce soir" },
];

app.post("/api/transcribe", async (req, res) => {
  const { audioId } = req.body || {};
  if (DEMO_MODE) {
    return res.json({ segments: DEMO_LYRICS, language: "fr", demo: true });
  }
  if (!REPLICATE_API_TOKEN) {
    return res.status(400).json({ error: "REPLICATE_API_TOKEN absent." });
  }
  if (!audioId || !/^[\w.-]+$/.test(audioId)) {
    return res.status(400).json({ error: "audioId invalide (upload la musique d'abord)." });
  }
  const path = join(UPLOAD_DIR, audioId);
  if (!existsSync(path)) {
    return res.status(404).json({ error: "audio introuvable, re-upload nécessaire." });
  }
  try {
    const buf = await readFile(path);
    const ext = audioId.split(".").pop().toLowerCase();
    const dataUri = `data:${MIME_BY_EXT[ext] || "audio/mpeg"};base64,${buf.toString("base64")}`;
    const p = await replicate(`/models/${WHISPER.owner}/${WHISPER.name}/predictions`, {
      method: "POST",
      headers: { Prefer: "wait" },
      body: JSON.stringify({ input: { audio: dataUri } }),
    });
    let out = p.output;
    let tries = 0;
    while (!out && p.id && tries < 40) {
      await new Promise((r) => setTimeout(r, 2000));
      const s = await replicate(`/predictions/${p.id}`);
      if (s.status === "succeeded") out = s.output;
      else if (s.status === "failed") throw new Error(s.error || "transcription échouée");
      tries++;
    }
    const segments = normalizeSegments(out);
    if (!segments.length) throw new Error("aucune parole détectée");
    res.json({ segments, language: out?.detected_language || out?.language || null });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// --- Upload de la musique (pour le montage final) ---
//  Reçoit le fichier audio brut, le stocke, renvoie un audioId.
const EXT_BY_MIME = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav",
  "audio/x-wav": "wav", "audio/wave": "wav", "audio/mp4": "m4a",
  "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/ogg": "ogg",
  "audio/flac": "flac",
};
app.post(
  "/api/upload-audio",
  express.raw({ type: () => true, limit: "80mb" }),
  async (req, res) => {
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: "fichier audio vide" });
    }
    const ext = EXT_BY_MIME[(req.headers["content-type"] || "").split(";")[0]] || "mp3";
    const id = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = join(UPLOAD_DIR, `${id}.${ext}`);
    try {
      await writeFile(path, req.body);
      res.json({ audioId: `${id}.${ext}` });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// --- Montage final : assemble les plans + la musique ---
//  Body : { shots:[{url,durationSec}], audioId, bpm,
//           aspectRatio, snapToBeat }
app.post("/api/assemble", async (req, res) => {
  if (!FFMPEG_PATH) {
    return res.status(503).json({
      error:
        "FFmpeg indisponible sur le serveur. Installe ffmpeg ou la dépendance ffmpeg-static.",
    });
  }
  const { shots, audioId, bpm, aspectRatio, snapToBeat } = req.body || {};
  if (!Array.isArray(shots) || !shots.length) {
    return res.status(400).json({ error: "aucun plan à assembler" });
  }
  // Sécurise l'audioId (pas de traversée de chemin).
  let audioPath = null;
  if (audioId && /^[\w.-]+$/.test(audioId)) {
    const p = join(UPLOAD_DIR, audioId);
    if (existsSync(p)) audioPath = p;
  }
  try {
    const result = await assembleClip(shots, {
      ffmpegPath: FFMPEG_PATH,
      audioPath,
      bpm: Number(bpm) || null,
      aspectRatio: aspectRatio || "16:9",
      snapToBeat: snapToBeat !== false,
      workDir: WORK_DIR,
      outDir: OUTPUT_DIR,
    });
    res.json({ url: `/outputs/${result.file}`, durationSec: result.durationSec });
  } catch (e) {
    console.error("assemble error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// --- Upscale 4K du clip monté ---
//  Body : { file (nom dans /outputs), aspectRatio, method }
//    method "fast" -> FFmpeg local (toujours dispo)
//    method "ai"   -> Replicate Real-ESRGAN (clé requise)
async function uploadToReplicate(buf, name) {
  const fd = new FormData();
  fd.append("content", new Blob([buf], { type: "video/mp4" }), name);
  const r = await fetch(`${REPLICATE_BASE}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
    body: fd,
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body?.detail || `upload Replicate HTTP ${r.status}`);
  const url = body?.urls?.get;
  if (!url) throw new Error("URL de fichier Replicate manquante");
  return url;
}

app.post("/api/upscale", async (req, res) => {
  const { file, aspectRatio = "16:9", method = "fast" } = req.body || {};
  // Sécurise le nom de fichier (pas de traversée de chemin).
  const safe = file ? basename(String(file)) : "";
  const inputPath = join(OUTPUT_DIR, safe);
  if (!safe || !existsSync(inputPath)) {
    return res.status(404).json({ error: "clip introuvable (monte d'abord le clip)." });
  }

  // Voie IA (Replicate) si demandée et possible.
  if (method === "ai" && !DEMO_MODE && REPLICATE_API_TOKEN) {
    try {
      const buf = await readFile(inputPath);
      const url = await uploadToReplicate(buf, safe);
      const input = UPSCALE_MODEL.buildInput(url, 2);
      const p = await replicate(
        `/models/${UPSCALE_MODEL.owner}/${UPSCALE_MODEL.name}/predictions`,
        { method: "POST", body: JSON.stringify({ input }) }
      );
      let out = p.output, tries = 0;
      while (!out && p.id && tries < 120) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await replicate(`/predictions/${p.id}`);
        if (s.status === "succeeded") out = s.output;
        else if (s.status === "failed") throw new Error(s.error || "upscale échoué");
        tries++;
      }
      const outUrl = Array.isArray(out) ? out[0] : out;
      if (!outUrl) throw new Error("aucune sortie d'upscale");
      return res.json({ url: outUrl, method: "ai" });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message });
    }
  }

  // Voie rapide : upscale FFmpeg local.
  if (!FFMPEG_PATH) {
    return res.status(503).json({ error: "FFmpeg indisponible pour l'upscale." });
  }
  try {
    const result = await upscaleTo4K(inputPath, {
      ffmpegPath: FFMPEG_PATH,
      aspectRatio,
      outDir: OUTPUT_DIR,
    });
    res.json({
      url: `/outputs/${result.file}`,
      method: DEMO_MODE && req.body?.method === "ai" ? "fast-fallback" : "fast",
      width: result.width,
      height: result.height,
    });
  } catch (e) {
    console.error("upscale error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
//  Sauvegarde des projets (JSON dans .work/projects)
// ============================================================
const isProjectId = (id) => /^proj-[\w-]+$/.test(id);
const projectPath = (id) => join(PROJECTS_DIR, `${id}.json`);

// Champs persistés (on ignore tout le reste envoyé par le client).
function sanitizeProject(body) {
  const p = body || {};
  const char = p.character || {};
  return {
    name: String(p.name || "Projet sans titre").slice(0, 120),
    idea: String(p.idea || "").slice(0, 2000),
    styleKey: p.styleKey || null,
    mood: p.mood || null,
    character: {
      description: String(char.description || "").slice(0, 500),
      gender: char.gender || "none",
      style: String(char.style || "").slice(0, 300),
      referenceImage: typeof char.referenceImage === "string" ? char.referenceImage : null,
    },
    consistencyMode: p.consistencyMode || "anchor",
    seed: Number(p.seed) || 0,
    modelKey: p.modelKey || null,
    aspectRatio: p.aspectRatio || "16:9",
    durationSec: Number(p.durationSec) || 5,
    shotCount: Number(p.shotCount) || 4,
    audio: p.audio || null,
    audioId: typeof p.audioId === "string" ? p.audioId : null,
    audioName: String(p.audioName || "").slice(0, 200),
    lyrics: Array.isArray(p.lyrics) ? p.lyrics.slice(0, 200) : null,
    useLyrics: Boolean(p.useLyrics),
    prompts: Array.isArray(p.prompts) ? p.prompts : [],
    results: p.results && typeof p.results === "object" ? p.results : {},
    lastClipFile: typeof p.lastClipFile === "string" ? p.lastClipFile : null,
  };
}

// Lister les projets (métadonnées légères).
app.get("/api/projects", async (req, res) => {
  try {
    const files = (await readdir(PROJECTS_DIR)).filter((f) => f.endsWith(".json"));
    const list = [];
    for (const f of files) {
      try {
        const j = JSON.parse(await readFile(join(PROJECTS_DIR, f), "utf8"));
        list.push({
          id: f.replace(/\.json$/, ""),
          name: j.name,
          styleKey: j.styleKey,
          updatedAt: j.updatedAt,
          shots: Object.keys(j.results || {}).length,
        });
      } catch {}
    }
    list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    res.json({ projects: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Créer / mettre à jour un projet.
app.post("/api/projects", async (req, res) => {
  try {
    const incomingId = req.body?.id;
    const id =
      incomingId && isProjectId(incomingId)
        ? incomingId
        : `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const existing = existsSync(projectPath(id))
      ? JSON.parse(await readFile(projectPath(id), "utf8"))
      : {};
    const data = {
      ...sanitizeProject(req.body),
      id,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await writeFile(projectPath(id), JSON.stringify(data, null, 2));
    res.json({ id, name: data.name, updatedAt: data.updatedAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Charger un projet complet.
app.get("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  if (!isProjectId(id) || !existsSync(projectPath(id))) {
    return res.status(404).json({ error: "projet introuvable" });
  }
  try {
    res.json(JSON.parse(await readFile(projectPath(id), "utf8")));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Supprimer un projet.
app.delete("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  if (!isProjectId(id) || !existsSync(projectPath(id))) {
    return res.status(404).json({ error: "projet introuvable" });
  }
  try {
    await unlink(projectPath(id));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, async () => {
  FFMPEG_PATH = await resolveFfmpeg();
  console.log(`\n  🎬  Rysao — AI Music Video`);
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ➜  Mode : ${DEMO_MODE ? "DÉMO (aucun crédit dépensé)" : "RÉEL (Replicate)"}`);
  console.log(`  ➜  Clé Replicate : ${REPLICATE_API_TOKEN ? "détectée ✅" : "absente ⚠️"}`);
  console.log(`  ➜  Montage FFmpeg : ${FFMPEG_PATH ? `prêt (${FFMPEG_PATH}) ✅` : "indisponible ⚠️"}\n`);
});
