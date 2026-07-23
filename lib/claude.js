// ============================================================
//  Analyse IA via Claude (Anthropic)
//  Reçoit le match + la prédiction statistique, renvoie une
//  analyse rédigée en français. Repli gracieux sans clé API.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function hasClaude() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Génère une analyse rédigée du match à partir de la prédiction stats.
 * @param {object} match  { home, away, utcDate }
 * @param {object} stats  sortie de predictMatch()
 * @param {object} standings { table } pour le contexte classement
 * @returns {Promise<{analysis: string, source: string}>}
 */
export async function analyzeMatch(match, stats, standings, scorers) {
  if (!hasClaude()) {
    return {
      analysis: fallbackAnalysis(match, stats, scorers),
      source: "stats",
    };
  }

  const client = new Anthropic();
  const homeRow = standings?.table?.[match.home.id];
  const awayRow = standings?.table?.[match.away.id];

  const context = {
    domicile: {
      nom: match.home.name,
      classement: homeRow?.position ?? "?",
      forme: homeRow?.form ?? "?",
      butsMarques: homeRow?.goalsFor ?? "?",
      butsEncaisses: homeRow?.goalsAgainst ?? "?",
    },
    exterieur: {
      nom: match.away.name,
      classement: awayRow?.position ?? "?",
      forme: awayRow?.form ?? "?",
      butsMarques: awayRow?.goalsFor ?? "?",
      butsEncaisses: awayRow?.goalsAgainst ?? "?",
    },
    modeleStatistique: stats,
    buteursProbables: scorers
      ? {
          domicile: scorers.home.map((p) => `${p.name} ${p.prob}%`),
          exterieur: scorers.away.map((p) => `${p.name} ${p.prob}%`),
        }
      : null,
  };

  const system =
    "Tu es un analyste football expert pour un site de pronostics. " +
    "Tu rédiges une analyse claire, honnête et concise en français. " +
    "Tu t'appuies sur les probabilités du modèle statistique fourni sans les contredire, " +
    "tu expliques le raisonnement (forme, attaque, défense, avantage du terrain), " +
    "et tu rappelles toujours que les paris comportent un risque. " +
    "Ne promets jamais un résultat certain.";

  const userPrompt =
    `Analyse ce match et donne un pronostic argumenté.\n\n` +
    `Données :\n${JSON.stringify(context, null, 2)}\n\n` +
    `Structure ta réponse en 4 parties courtes :\n` +
    `1. **Le contexte** (forme et dynamique des 2 équipes)\n` +
    `2. **L'analyse du modèle** (ce que disent les probabilités et le score probable)\n` +
    `3. **Les buteurs probables** (cite les joueurs de buteursProbables s'ils existent ; ` +
    `rappelle que c'est l'élément le plus incertain. Ignore cette partie si la liste est vide)\n` +
    `4. **Le pronostic** (ton conseil + niveau de confiance + rappel du risque)\n` +
    `Maximum 280 mots.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return {
      analysis: text || fallbackAnalysis(match, stats, scorers),
      source: "claude",
    };
  } catch (e) {
    console.error("Claude error, fallback stats:", e.message);
    return { analysis: fallbackAnalysis(match, stats, scorers), source: "stats" };
  }
}

// Analyse générée sans IA (texte gabarit basé sur les chiffres)
function fallbackAnalysis(match, stats, scorers) {
  const { probabilities, pick, topScores, markets, expectedGoals } = stats;

  let scorersBlock = "";
  if (scorers && (scorers.home.length || scorers.away.length)) {
    const fmt = (list) =>
      list.length ? list.map((p) => `${p.name} ${p.prob}%`).join(", ") : "—";
    scorersBlock =
      `\n\n**Buteurs probables**\n` +
      `${match.home.name} : ${fmt(scorers.home)}\n` +
      `${match.away.name} : ${fmt(scorers.away)}\n` +
      `(les buteurs sont l'élément le plus incertain d'un pronostic)`;
  }

  return (
    `**Analyse statistique — ${match.home.name} vs ${match.away.name}**\n\n` +
    `Le modèle estime les buts attendus à ${expectedGoals.home} pour ${match.home.name} ` +
    `et ${expectedGoals.away} pour ${match.away.name}.\n\n` +
    `Probabilités : victoire ${match.home.name} ${probabilities.home}%, ` +
    `nul ${probabilities.draw}%, victoire ${match.away.name} ${probabilities.away}%.\n\n` +
    `Score le plus probable : ${topScores[0].score} (${topScores[0].prob}%). ` +
    `Plus de 2,5 buts : ${markets.over25}%. Les deux équipes marquent : ${markets.bttsYes}%.` +
    scorersBlock +
    `\n\n**Pronostic : ${pick.label}** (confiance ${pick.confidence}%).\n\n` +
    `⚠️ Les pronostics sont des estimations probabilistes, jamais une certitude. ` +
    `Pariez de manière responsable.`
  );
}
