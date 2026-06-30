// ============================================================
//  Montage automatique des plans en un seul clip (FFmpeg)
// ------------------------------------------------------------
//  1. Télécharge chaque plan généré (URL Replicate / démo)
//  2. Uniformise chaque plan (résolution / fps) et le découpe
//     sur une grille de beats (calage rythmique via le BPM)
//  3. Concatène les plans
//  4. Ajoute la musique d'origine et exporte un seul .mp4
// ============================================================
import { execFile } from "node:child_process";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Résolutions de sortie du montage selon le format choisi.
const RESOLUTIONS = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};
const FPS = 24;

function run(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.message = `${err.message}\n${stderr || ""}`.slice(0, 2000);
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`téléchargement échoué (${res.status}) : ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

// Découpe la durée d'un plan pour qu'il tienne sur un nombre
// entier de beats -> les coupes tombent pile sur le rythme.
function snapDuration(requestedSec, bpm, snap) {
  if (!snap || !bpm) return Math.max(1, requestedSec);
  const beat = 60 / bpm;
  const beats = Math.max(1, Math.round(requestedSec / beat));
  return +(beats * beat).toFixed(3);
}

// shots : [{ url, durationSec }]
// opts  : { ffmpegPath, audioPath, bpm, aspectRatio, snapToBeat, workDir, outDir }
export async function assembleClip(shots, opts) {
  const {
    ffmpegPath,
    audioPath,
    bpm,
    aspectRatio = "16:9",
    snapToBeat = true,
    workDir,
    outDir,
  } = opts;

  if (!shots?.length) throw new Error("aucun plan à assembler");
  const [W, H] = RESOLUTIONS[aspectRatio] || RESOLUTIONS["16:9"];

  const tmp = join(workDir, `job-${Date.now()}`);
  await mkdir(tmp, { recursive: true });
  await mkdir(outDir, { recursive: true });

  try {
    const intermediates = [];
    let totalDur = 0;

    for (let i = 0; i < shots.length; i++) {
      const src = join(tmp, `src-${i}.mp4`);
      await download(shots[i].url, src);

      const dur = snapDuration(Number(shots[i].durationSec) || 5, bpm, snapToBeat);
      totalDur += dur;
      const inter = join(tmp, `inter-${i}.mp4`);

      // Uniformise : échelle + letterbox + fps + durée, sans audio.
      await run(ffmpegPath, [
        "-y", "-i", src,
        "-t", String(dur),
        "-vf",
        `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
          `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS}`,
        "-an",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
        inter,
      ]);
      intermediates.push(inter);
    }

    // Liste de concaténation pour le démuxeur concat.
    const listPath = join(tmp, "list.txt");
    await writeFile(
      listPath,
      intermediates.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
    );

    const outName = `clip-${Date.now()}.mp4`;
    const outPath = join(outDir, outName);

    // Concatène + ajoute la musique (coupée à la durée des plans).
    const args = [
      "-y",
      "-f", "concat", "-safe", "0", "-i", listPath,
    ];
    if (audioPath && existsSync(audioPath)) {
      args.push(
        "-i", audioPath,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest"
      );
    } else {
      args.push("-c:v", "copy");
    }
    args.push(outPath);
    await run(ffmpegPath, args);

    return { file: outName, path: outPath, durationSec: +totalDur.toFixed(2) };
  } finally {
    // Nettoyage des fichiers temporaires (on garde la sortie).
    rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// Vérifie qu'un binaire ffmpeg répond à "-version".
export async function ffmpegWorks(bin) {
  if (!bin) return false;
  try {
    await run(bin, ["-version"]);
    return true;
  } catch {
    return false;
  }
}
