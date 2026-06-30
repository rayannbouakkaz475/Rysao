// ============================================================
//  Constructeur de prompts
// ------------------------------------------------------------
//  Transforme les choix de l'utilisateur (style du clip,
//  personnage, ambiance) + l'analyse audio en une liste de
//  prompts, un par "plan" (shot) du clip.
// ============================================================

// Banque de styles visuels -> fragments de prompt riches.
export const CLIP_STYLES = {
  concert: {
    label: "Concert live",
    base: "live concert performance on a massive stage, dynamic crowd, dramatic stage lighting, lens flares, energetic atmosphere",
    camera: ["sweeping crane shot over the crowd", "close-up on the performer", "wide stage shot", "handheld energetic movement"],
  },
  cinematic: {
    label: "Cinématique",
    base: "cinematic film look, anamorphic lens, shallow depth of field, moody color grading, volumetric light, film grain",
    camera: ["slow dolly push-in", "sweeping aerial drone shot", "tracking shot following the subject", "static wide establishing shot"],
  },
  anime: {
    label: "Anime / animé",
    base: "high quality anime style, vibrant cel shading, expressive characters, detailed backgrounds, dynamic action lines",
    camera: ["dramatic low angle", "speed-line action shot", "emotional close-up", "panoramic establishing shot"],
  },
  neon: {
    label: "Néon / cyberpunk",
    base: "cyberpunk neon city at night, rain-soaked streets, glowing holograms, reflective surfaces, blade-runner aesthetic, vivid magenta and cyan",
    camera: ["low tracking shot through neon alley", "reflection shot in a puddle", "high aerial over the city", "slow orbit around the subject"],
  },
  nature: {
    label: "Nature épique",
    base: "epic natural landscape, golden hour light, vast scenery, mist, photorealistic, breathtaking scale",
    camera: ["sweeping drone flyover", "slow reveal over a ridge", "intimate ground-level shot", "time-of-day transition"],
  },
  abstract: {
    label: "Abstrait / visuel",
    base: "abstract flowing visuals, liquid color, particle systems, fractal geometry, hypnotic motion, audio-reactive shapes",
    camera: ["infinite zoom", "fluid morphing transition", "kaleidoscopic motion", "slow drifting camera"],
  },
  retro: {
    label: "Rétro 80s / VHS",
    base: "retro 1980s aesthetic, VHS grain, chrome text vibes, sunset gradient, synthwave palette, nostalgic film look",
    camera: ["slow zoom on horizon", "grid floor tracking shot", "static retro framing", "lens-flare reveal"],
  },
};

// Banque d'ambiances, déduites ou choisies, qui colorent le prompt.
export const MOODS = {
  energetic: "high energy, fast motion, punchy and explosive",
  dreamy: "dreamy, ethereal, soft and floating atmosphere",
  dark: "dark, intense, dramatic and brooding mood",
  uplifting: "uplifting, bright, hopeful and warm",
  melancholic: "melancholic, emotional, introspective and tender",
};

const QUALITY = "ultra realistic, 4K, highly detailed, sharp focus, professional color grading, cinematic lighting";
const NEGATIVE = "blurry, low quality, distorted, deformed, watermark, text, extra limbs, glitch, low resolution";

// Décrit un personnage à partir des choix de l'utilisateur.
function describeCharacter(c) {
  if (!c || (!c.description && !c.gender && !c.style)) return "";
  const parts = [];
  if (c.gender && c.gender !== "none") parts.push(c.gender);
  if (c.description) parts.push(c.description);
  if (c.style) parts.push(`wearing ${c.style}`);
  const who = parts.filter(Boolean).join(", ");
  return who ? `featuring ${who}` : "";
}

// Nettoie l'idée libre saisie par l'utilisateur (texte -> fragment de prompt).
function cleanIdea(idea) {
  return (idea || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

// Construit la liste de prompts (un par plan).
// `config` :
//   { styleKey, mood, character, shotCount, idea, audio: { bpm, mood } }
export function buildPrompts(config) {
  const style = CLIP_STYLES[config.styleKey] || CLIP_STYLES.cinematic;
  const moodKey = config.mood || config.audio?.mood || "energetic";
  const moodText = MOODS[moodKey] || MOODS.energetic;
  const character = describeCharacter(config.character);
  const idea = cleanIdea(config.idea);
  const shotCount = Math.max(1, Math.min(12, Number(config.shotCount) || 4));

  const tempoHint = config.audio?.bpm
    ? config.audio.bpm > 120
      ? "fast rhythmic editing, motion synced to an upbeat tempo"
      : "smooth slow motion, motion synced to a calm tempo"
    : "";

  const prompts = [];
  for (let i = 0; i < shotCount; i++) {
    const camera = style.camera[i % style.camera.length];
    const segments = [
      idea,           // l'idée libre de l'utilisateur prime
      style.base,
      character,
      camera,
      moodText,
      tempoHint,
      `music video shot ${i + 1} of ${shotCount}`,
      QUALITY,
    ].filter(Boolean);
    prompts.push({
      index: i,
      prompt: segments.join(", "),
      negativePrompt: NEGATIVE,
    });
  }
  return prompts;
}

// Construit des plans à partir des PAROLES transcrites (Whisper).
//  Les segments sont regroupés en `shotCount` plans contigus ; chaque
//  plan illustre ses paroles et hérite de la durée réelle (timestamps).
//  segments : [{ start, end, text }]
export function buildPromptsFromLyrics(config, segments) {
  const clean = (segments || []).filter((s) => s && (s.text || "").trim());
  if (!clean.length) return buildPrompts(config);

  const style = CLIP_STYLES[config.styleKey] || CLIP_STYLES.cinematic;
  const moodKey = config.mood || config.audio?.mood || "energetic";
  const moodText = MOODS[moodKey] || MOODS.energetic;
  const character = describeCharacter(config.character);
  const idea = cleanIdea(config.idea);
  const shotCount = Math.max(1, Math.min(12, Number(config.shotCount) || clean.length));

  // Regroupe les segments en `shotCount` paquets contigus.
  const groups = [];
  const per = Math.ceil(clean.length / shotCount);
  for (let i = 0; i < clean.length; i += per) groups.push(clean.slice(i, i + per));

  return groups.map((g, i) => {
    const text = g.map((s) => s.text.trim()).join(" ").replace(/\s+/g, " ").trim();
    const span = (g[g.length - 1].end ?? 0) - (g[0].start ?? 0);
    const durationSec = Math.max(3, Math.min(10, Math.round(span) || 5));
    const camera = style.camera[i % style.camera.length];
    const prompt = [
      idea,           // l'idée libre de l'utilisateur prime
      style.base,
      character,
      camera,
      moodText,
      `visualizing the lyrics: "${text.slice(0, 180)}"`,
      QUALITY,
    ].filter(Boolean).join(", ");
    return {
      index: i,
      prompt,
      negativePrompt: NEGATIVE,
      durationSec,
      lyric: text,
      startSec: +(g[0].start ?? 0).toFixed(2),
    };
  });
}

// Prompt pour l'IMAGE d'ancrage du personnage : un portrait net,
// fond neutre, qui servira de référence visuelle à tous les plans.
export function buildAnchorPrompt(character, styleKey) {
  const style = CLIP_STYLES[styleKey];
  const who = describeCharacter(character) || "a charismatic music artist";
  const styleHint = style ? style.base.split(",")[0] : "cinematic";
  return {
    prompt: [
      `character reference portrait, ${who.replace(/^featuring /, "")}`,
      "centered, looking at camera, upper body, clean simple background",
      `${styleHint} aesthetic`,
      "consistent character design, photorealistic, sharp focus, soft studio lighting, 4K",
    ].join(", "),
    negativePrompt: NEGATIVE,
  };
}

export function publicStyleList() {
  return Object.entries(CLIP_STYLES).map(([key, s]) => ({ key, label: s.label }));
}

export function publicMoodList() {
  return Object.entries(MOODS).map(([key]) => ({
    key,
    label: { energetic: "Énergique", dreamy: "Rêveur", dark: "Sombre", uplifting: "Lumineux", melancholic: "Mélancolique" }[key] || key,
  }));
}
