// ============================================================
//  Modèle de prédiction des buteurs
//  Répartit les buts attendus de chaque équipe (calculés par le
//  modèle statistique) entre ses meilleurs buteurs, puis estime
//  la probabilité que chacun marque au moins une fois (Poisson).
//
//  ⚠️ Prédiction indicative : les buteurs sont l'élément le plus
//  aléatoire du football (compositions, blessures, hasard).
// ============================================================

// Part des buts d'une équipe réellement inscrits par ses tout meilleurs
// buteurs (le reste vient d'autres joueurs, csc, etc.).
const COVERAGE = 0.7;

function buildTeam(team, expectedGoals, topScorers, perTeam) {
  const players = (topScorers || []).filter(
    (p) => p.teamId === team.id && p.goals > 0
  );
  if (players.length === 0) return [];

  const denom = players.reduce((s, p) => s + p.goals, 0) || 1;

  return players
    .map((p) => {
      // Buts attendus de CE joueur sur CE match
      const lambda = expectedGoals * COVERAGE * (p.goals / denom);
      // Probabilité de marquer au moins une fois
      const prob = 1 - Math.exp(-lambda);
      return {
        name: p.name,
        photo: p.photo || null,
        goals: p.goals,
        prob: Math.round(prob * 100),
      };
    })
    .filter((p) => p.prob > 0)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, perTeam);
}

/**
 * @param {object} match     { home:{id,name}, away:{id,name} }
 * @param {object} prediction sortie de predictMatch() (utilise expectedGoals)
 * @param {Array}  topScorers liste [{ playerId, name, teamId, goals, photo }]
 * @param {object} opts       { perTeam }
 * @returns {{home: Array, away: Array}|null}
 */
export function predictScorers(match, prediction, topScorers, opts = {}) {
  const perTeam = opts.perTeam ?? 3;
  if (!topScorers || topScorers.length === 0) return null;

  const home = buildTeam(
    match.home,
    prediction.expectedGoals.home,
    topScorers,
    perTeam
  );
  const away = buildTeam(
    match.away,
    prediction.expectedGoals.away,
    topScorers,
    perTeam
  );

  if (home.length === 0 && away.length === 0) return null;
  return { home, away };
}
