// ============================================================
//  Registre des modèles vidéo Replicate + adaptateurs d'entrée
// ------------------------------------------------------------
//  Chaque modèle de Replicate attend des champs d'entrée
//  différents (prompt, image de départ, ratio, durée...).
//  On normalise tout via une requête commune :
//
//    {
//      prompt:           string,
//      negativePrompt:   string,
//      durationSec:      number,   // durée souhaitée du plan
//      aspectRatio:      "16:9" | "9:16" | "1:1",
//      referenceImage:   string | null  // data URI ou URL (image-to-video)
//    }
//
//  `buildInput(req)` retourne l'objet `input` attendu par
//  l'API Replicate pour CE modèle précis.
// ============================================================

export const MODELS = {
  "kling-2.1": {
    label: "Kling v2.1 (réaliste, cinématique)",
    // Endpoint "officiel" Replicate : on cible le modèle par owner/name,
    // ce qui évite d'avoir à coder un hash de version.
    owner: "kwaivgi",
    name: "kling-v2.1",
    supportsReferenceImage: true,
    maxDurationSec: 10,
    buildInput(req) {
      const input = {
        prompt: req.prompt,
        negative_prompt: req.negativePrompt || "",
        aspect_ratio: req.aspectRatio || "16:9",
        // Kling n'accepte que 5 ou 10 secondes
        duration: req.durationSec >= 8 ? 10 : 5,
      };
      if (req.referenceImage) input.start_image = req.referenceImage;
      return input;
    },
  },

  "kling-1.6": {
    label: "Kling v1.6 Standard (rapide, moins cher)",
    owner: "kwaivgi",
    name: "kling-v1.6-standard",
    supportsReferenceImage: true,
    maxDurationSec: 10,
    buildInput(req) {
      const input = {
        prompt: req.prompt,
        negative_prompt: req.negativePrompt || "",
        aspect_ratio: req.aspectRatio || "16:9",
        cfg_scale: 0.5,
        duration: req.durationSec >= 8 ? 10 : 5,
      };
      if (req.referenceImage) input.start_image = req.referenceImage;
      return input;
    },
  },

  minimax: {
    label: "MiniMax Hailuo (video-01)",
    owner: "minimax",
    name: "video-01",
    supportsReferenceImage: true,
    maxDurationSec: 6,
    buildInput(req) {
      const input = { prompt: req.prompt, prompt_optimizer: true };
      if (req.referenceImage) input.first_frame_image = req.referenceImage;
      return input;
    },
  },

  "wan-2.1": {
    label: "Wan 2.1 (open-source, économique)",
    owner: "wan-video",
    name: "wan-2.1-1.3b",
    supportsReferenceImage: false,
    maxDurationSec: 5,
    buildInput(req) {
      return {
        prompt: req.prompt,
        negative_prompt: req.negativePrompt || "",
        aspect_ratio: req.aspectRatio === "9:16" ? "9:16" : "16:9",
      };
    },
  },

  "luma-ray": {
    label: "Luma Ray 2 (720p, fluide)",
    owner: "luma",
    name: "ray-2-720p",
    supportsReferenceImage: true,
    maxDurationSec: 9,
    buildInput(req) {
      const input = {
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio || "16:9",
      };
      if (req.referenceImage) input.start_image_url = req.referenceImage;
      return input;
    },
  },
};

export function getModel(key) {
  return MODELS[key] || null;
}

// Liste légère envoyée au frontend (sans les fonctions).
export function publicModelList() {
  return Object.entries(MODELS).map(([key, m]) => ({
    key,
    label: m.label,
    supportsReferenceImage: m.supportsReferenceImage,
    maxDurationSec: m.maxDurationSec,
  }));
}
