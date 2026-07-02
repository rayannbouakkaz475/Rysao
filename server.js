// Serveur de l'Atelier de Paroles RYSAO
// -------------------------------------
// - Sert les fichiers statiques du site (index.html, paroles.html, assets…)
// - Expose POST /api/paroles qui relaie la requête vers l'API Claude en streaming.
//   La clé API reste côté serveur (variable d'environnement ANTHROPIC_API_KEY)
//   et n'est jamais exposée au navigateur.
//
// Démarrage :  ANTHROPIC_API_KEY=sk-ant-... node server.js
//        ou :  copier .env.example -> .env, y mettre la clé, puis  npm start
//
// Aucune dépendance externe — Node 18+ uniquement (global fetch requis).

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

/* --- Chargement minimal du fichier .env (facultatif) --- */
try {
  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    for (const ligne of fs.readFileSync(envPath, "utf8").split("\n")) {
      const l = ligne.trim();
      if (!l || l.startsWith("#")) continue;
      const i = l.indexOf("=");
      if (i === -1) continue;
      const cle = l.slice(0, i).trim();
      let val = l.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(cle in process.env)) process.env[cle] = val;
    }
  }
} catch (e) { /* ignore */ }

const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function envoyerJson(res, code, obj) {
  const corps = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(corps);
}

/* --- Proxy vers l'API Claude (streaming) --- */
async function relayerParoles(req, res) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) {
    return envoyerJson(res, 501, {
      error: { message: "ANTHROPIC_API_KEY n'est pas configurée côté serveur." },
    });
  }

  // Lecture du corps de la requête
  let brut = "";
  req.on("data", (c) => { brut += c; if (brut.length > 1e6) req.destroy(); });
  await new Promise((r) => req.on("end", r));

  let systeme = "", prompt = "";
  try {
    const b = JSON.parse(brut || "{}");
    systeme = typeof b.systeme === "string" ? b.systeme : "";
    prompt = typeof b.prompt === "string" ? b.prompt : "";
  } catch (e) {
    return envoyerJson(res, 400, { error: { message: "Corps JSON invalide." } });
  }
  if (!prompt.trim()) {
    return envoyerJson(res, 400, { error: { message: "Requête vide." } });
  }

  const controleur = new AbortController();
  req.on("close", () => controleur.abort());

  let amont;
  try {
    amont = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controleur.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": cle,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 4000,
        stream: true,
        system: systeme || undefined,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (e) {
    if (!res.headersSent) envoyerJson(res, 502, { error: { message: "Impossible de joindre l'API Claude." } });
    return;
  }

  if (!amont.ok || !amont.body) {
    let détail = "";
    try { détail = await amont.text(); } catch (e) { /* ignore */ }
    return envoyerJson(res, amont.status, {
      error: { message: "Erreur de l'API Claude (" + amont.status + "). " + détail },
    });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const lecteur = amont.body.getReader();
  try {
    while (true) {
      const { value, done } = await lecteur.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (e) {
    // client déconnecté ou flux interrompu
  } finally {
    try { res.end(); } catch (e) { /* ignore */ }
  }
}

/* --- Fichiers statiques --- */
function servirStatique(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://local").pathname);
  } catch (e) {
    res.writeHead(400); return res.end("Requête invalide");
  }
  if (urlPath === "/") urlPath = "/index.html";

  const chemin = path.normalize(path.join(ROOT, urlPath));
  if (!chemin.startsWith(ROOT)) {
    res.writeHead(403); return res.end("Accès refusé");
  }

  fs.stat(chemin, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 — Introuvable");
    }
    const type = MIME[path.extname(chemin).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(chemin).pipe(res);
  });
}

/* --- Routage --- */
const serveur = http.createServer((req, res) => {
  const urlPath = (req.url || "").split("?")[0];
  if (req.method === "POST" && urlPath === "/api/paroles") {
    relayerParoles(req, res).catch(() => {
      if (!res.headersSent) envoyerJson(res, 500, { error: { message: "Erreur interne du serveur." } });
    });
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    return servirStatique(req, res);
  }
  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Méthode non autorisée");
});

serveur.listen(PORT, () => {
  const cleOk = process.env.ANTHROPIC_API_KEY ? "clé API détectée ✓" : "⚠ ANTHROPIC_API_KEY absente — configurez-la avant de composer";
  console.log(`RYSAO — Atelier de Paroles`);
  console.log(`  → http://localhost:${PORT}/paroles.html`);
  console.log(`  → ${cleOk}`);
});
