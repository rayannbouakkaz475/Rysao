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

// Dimensions cibles 4K selon le format.
const UHD = {
  "16:9": [3840, 2160],
  "9:16": [2160, 3840],
  "1:1": [2160, 2160],
};

// Upscale LOCAL vers la 4K (FFmpeg, lanczos + légère accentuation).
//  Pas de l'IA, mais un vrai export 4K, gratuit et instantané.
export async function upscaleTo4K(inputPath, opts) {
  const { ffmpegPath, aspectRatio = "16:9", outDir } = opts;
  const [W, H] = UHD[aspectRatio] || UHD["16:9"];
  await mkdir(outDir, { recursive: true });
  const outName = `clip-${Date.now()}-4k.mp4`;
  const outPath = join(outDir, outName);
  await run(ffmpegPath, [
    "-y", "-i", inputPath,
    "-vf", `scale=${W}:${H}:flags=lanczos,unsharp=5:5:0.6:5:5:0.0`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18",
    "-c:a", "copy",
    outPath,
  ]);
  return { file: outName, path: outPath, width: W, height: H };
}

// Extrait la DERNIÈRE image d'une vidéo -> data URI JPEG.
//  Sert au mode "enchaînement" : cette image devient l'image de
//  départ du plan suivant (continuité du personnage / décor).
export async function extractLastFrame(videoUrl, opts) {
  const { ffmpegPath, workDir } = opts;
  const tmp = join(workDir, `frame-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  await mkdir(tmp, { recursive: true });
  const src = join(tmp, "src.mp4");
  const out = join(tmp, "last.jpg");
  try {
    await download(videoUrl, src);
    // -sseof -0.1 : se positionne ~0,1s avant la fin et prend 1 image.
    await run(ffmpegPath, [
      "-y", "-sseof", "-0.2", "-i", src,
      "-vframes", "1", "-q:v", "3", out,
    ]);
    const buf = await readFile(out);
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } finally {
    rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// Découpe un segment audio [startSec, startSec+durationSec] -> fichier WAV.
//  Sert au lip-sync : on n'envoie que la portion de chanson qui
//  correspond au plan, pour que la bouche suive les bonnes paroles.
export async function trimAudio(inputPath, startSec, durationSec, opts) {
  const { ffmpegPath, outDir } = opts;
  await mkdir(outDir, { recursive: true });
  const out = join(outDir, `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.wav`);
  await run(ffmpegPath, [
    "-y",
    "-ss", String(Math.max(0, startSec || 0)),
    "-t", String(Math.max(1, durationSec || 5)),
    "-i", inputPath,
    "-vn", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le",
    out,
  ]);
  return out;
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
