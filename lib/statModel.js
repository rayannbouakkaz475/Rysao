// ============================================================
//  Modèle de prédiction statistique (Poisson bivarié simplifié)
//  Estime la probabilité de victoire domicile / nul / extérieur
//  + les scores les plus probables, à partir du classement.
// ============================================================

// Avantage du terrain (buts attendus en plus pour le domicile)
const HOME_ADVANTAGE = 0.25;
// Moyenne de buts par équipe et par match (référence championnats européens)
const LEAGUE_AVG_GOALS = 1.4;

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// Probabilité de marquer exactement k buts (loi de Poisson)
function poisson(k, lambda) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Points de forme récents (W=3, D=1, L=0) normalisés sur [0,1]
function formScore(form) {
  if (!form) return 0.5;
  const games = form.split(",").map((s) => s.trim()).filter(Boolean);
  if (games.length === 0) return 0.5;
  const pts = games.reduce(
    (sum, g) => sum + (g === "W" ? 3 : g === "D" ? 1 : 0),
    0
  );
  return pts / (games.length * 3);
}

// Force d'attaque/défense d'une équipe relative à la moyenne du championnat
function teamStrength(team, leagueAvgFor, leagueAvgAgainst) {
  const played = Math.max(team.playedGames || 1, 1);
  const attack = (team.goalsFor / played) / leagueAvgFor; // >1 = bonne attaque
  const defense = (team.goalsAgainst / played) / leagueAvgAgainst; // <1 = bonne défense
  return { attack, defense };
}

/**
 * Calcule la prédiction pour un match.
 * @param {object} home équipe domicile (ligne de classement)
 * @param {object} away équipe extérieur (ligne de classement)
 * @returns {object} probabilités, lambdas, scores probables, confiance
 */
export function predictMatch(home, away) {
  // Moyennes du championnat à partir des deux équipes (approximation locale)
  const sample = [home, away].filter(Boolean);
  const avgFor =
    sample.reduce((s, t) => s + t.goalsFor / Math.max(t.playedGames, 1), 0) /
      sample.length || LEAGUE_AVG_GOALS;
  const avgAgainst = avgFor; // symétrie : buts marqués = buts encaissés à l'échelle ligue

  const h = teamStrength(home, avgFor, avgAgainst);
  const a = teamStrength(away, avgFor, avgAgainst);

  // Pondération par la forme récente (±20 %)
  const homeForm = 0.9 + formScore(home.form) * 0.2;
  const awayForm = 0.9 + formScore(away.form) * 0.2;

  // Buts attendus (lambda) pour chaque équipe
  let lambdaHome =
    h.attack * a.defense * avgFor * homeForm + HOME_ADVANTAGE;
  let lambdaAway = a.attack * h.defense * avgFor * awayForm;

  lambdaHome = Math.max(0.2, Math.min(lambdaHome, 5));
  lambdaAway = Math.max(0.2, Math.min(lambdaAway, 5));

  // Matrice des scores 0..6 buts
  const maxGoals = 6;
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  const scoreGrid = [];

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = poisson(i, lambdaHome) * poisson(j, lambdaAway);
      scoreGrid.push({ home: i, away: j, p });
      if (i > j) pHome += p;
      else if (i === j) pDraw += p;
      else pAway += p;
    }
  }

  // Normalisation (les buts >6 sont négligés)
  const total = pHome + pDraw + pAway;
  pHome /= total;
  pDraw /= total;
  pAway /= total;

  // 3 scores les plus probables
  const topScores = scoreGrid
    .sort((x, y) => y.p - x.p)
    .slice(0, 3)
    .map((s) => ({
      score: `${s.home}-${s.away}`,
      prob: Math.round((s.p / total) * 100),
    }));

  // Probas marchés annexes
  const over25 = scoreGrid
    .filter((s) => s.home + s.away > 2)
    .reduce((sum, s) => sum + s.p, 0) / total;
  const bttsYes = scoreGrid
    .filter((s) => s.home > 0 && s.away > 0)
    .reduce((sum, s) => sum + s.p, 0) / total;

  // Pronostic et indice de confiance
  const probs = [
    { outcome: "1", label: `${home.name} gagne`, prob: pHome },
    { outcome: "N", label: "Match nul", prob: pDraw },
    { outcome: "2", label: `${away.name} gagne`, prob: pAway },
  ].sort((x, y) => y.prob - x.prob);

  const pick = probs[0];
  const confidence = Math.round(pick.prob * 100);

  return {
    probabilities: {
      home: Math.round(pHome * 100),
      draw: Math.round(pDraw * 100),
      away: Math.round(pAway * 100),
    },
    expectedGoals: {
      home: Number(lambdaHome.toFixed(2)),
      away: Number(lambdaAway.toFixed(2)),
    },
    topScores,
    markets: {
      over25: Math.round(over25 * 100),
      under25: Math.round((1 - over25) * 100),
      bttsYes: Math.round(bttsYes * 100),
      bttsNo: Math.round((1 - bttsYes) * 100),
    },
    pick: { outcome: pick.outcome, label: pick.label, confidence },
  };
}
