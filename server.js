// ============================================================
//  Rysao — AI Music Video  |  Serveur Express + Replicate
// ============================================================
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

import { getModel, publicModelList } from "./models.js";
import { buildPrompts, publicStyleList, publicMoodList } from "./promptBuilder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const app = express();
app.use(express.json({ limit: "25mb" })); // large pour accepter une image de référence en data URI
app.use(express.static(join(__dirname, "public")));

// --- Config exposée au frontend ---
app.get("/api/config", (req, res) => {
  res.json({
    demoMode: DEMO_MODE,
    hasToken: Boolean(REPLICATE_API_TOKEN),
    defaultModel: DEFAULT_MODEL,
    models: publicModelList(),
    styles: publicStyleList(),
    moods: publicMoodList(),
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
    const prompts = buildPrompts(req.body || {});
    res.json({ prompts });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- Lancer la génération d'UN plan ---
//  Body attendu :
//   { modelKey, prompt, negativePrompt, durationSec,
//     aspectRatio, referenceImage }
app.post("/api/generate", async (req, res) => {
  const {
    modelKey = DEFAULT_MODEL,
    prompt,
    negativePrompt = "",
    durationSec = 5,
    aspectRatio = "16:9",
    referenceImage = null,
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

app.listen(PORT, () => {
  console.log(`\n  🎬  Rysao — AI Music Video`);
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ➜  Mode : ${DEMO_MODE ? "DÉMO (aucun crédit dépensé)" : "RÉEL (Replicate)"}`);
  console.log(`  ➜  Clé Replicate : ${REPLICATE_API_TOKEN ? "détectée ✅" : "absente ⚠️"}\n`);
});
