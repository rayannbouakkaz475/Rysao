/* Copie les fichiers web de la PWA (../app) vers ./www pour Capacitor.
   On exclut le dossier backend/, la doc et les fichiers d'exemple. */
import { cp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const APP = join(here, "..", "..", "app");
const WWW = join(here, "..", "www");

const INCLUDE = ["index.html", "manifest.webmanifest", "sw.js", "css", "js"];
const EXCLUDE_FILES = new Set(["config.example.js"]); // ne pas embarquer les exemples

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });

for (const entry of INCLUDE) {
  const src = join(APP, entry);
  if (!existsSync(src)) { console.warn("skip (absent):", entry); continue; }
  await cp(src, join(WWW, entry), {
    recursive: true,
    filter: (p) => !EXCLUDE_FILES.has(p.split(/[\\/]/).pop()),
  });
}

console.log("✓ Web copié dans", WWW);
