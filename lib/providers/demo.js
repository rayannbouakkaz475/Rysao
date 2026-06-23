// ============================================================
//  Fournisseur de démo (aucune clé requise)
//  Championnat de Ligue 1 fictif, pour tester le site.
// ============================================================

const TEAMS = [
  { teamId: 1, name: "Paris SG", position: 1, playedGames: 10, goalsFor: 28, goalsAgainst: 8, points: 26, form: "W,W,W,D,W" },
  { teamId: 2, name: "Monaco", position: 2, playedGames: 10, goalsFor: 21, goalsAgainst: 12, points: 22, form: "W,W,D,W,L" },
  { teamId: 3, name: "Marseille", position: 3, playedGames: 10, goalsFor: 19, goalsAgainst: 13, points: 20, form: "W,D,W,L,W" },
  { teamId: 4, name: "Lille", position: 4, playedGames: 10, goalsFor: 16, goalsAgainst: 11, points: 19, form: "D,W,W,D,L" },
  { teamId: 5, name: "Lyon", position: 5, playedGames: 10, goalsFor: 15, goalsAgainst: 14, points: 16, form: "L,W,D,W,D" },
  { teamId: 6, name: "Nice", position: 6, playedGames: 10, goalsFor: 13, goalsAgainst: 13, points: 15, form: "D,L,W,D,W" },
  { teamId: 7, name: "Lens", position: 7, playedGames: 10, goalsFor: 12, goalsAgainst: 14, points: 13, form: "L,D,W,L,D" },
  { teamId: 8, name: "Rennes", position: 8, playedGames: 10, goalsFor: 14, goalsAgainst: 16, points: 12, form: "W,L,L,D,W" },
  { teamId: 9, name: "Nantes", position: 9, playedGames: 10, goalsFor: 9, goalsAgainst: 17, points: 9, form: "L,L,D,W,L" },
  { teamId: 10, name: "Le Havre", position: 10, playedGames: 10, goalsFor: 8, goalsAgainst: 20, points: 7, form: "L,D,L,L,D" },
];

export async function getStandings() {
  const table = {};
  for (const t of TEAMS) table[t.teamId] = { ...t, crest: null };
  return { table, demo: true };
}

export async function getUpcomingMatches(_code, limit = 10) {
  const now = Date.now();
  const day = 86400000;
  const pairs = [
    [1, 3], [2, 4], [5, 6], [7, 8], [9, 10],
    [3, 2], [4, 5], [1, 6], [8, 9], [10, 7],
  ];
  const names = {};
  for (const t of TEAMS) names[t.teamId] = t.name;
  return pairs
    .map((p, i) => ({
      id: `demo-${i + 1}`,
      competition: "FL1",
      utcDate: new Date(now + (i + 1) * day).toISOString(),
      matchday: 11,
      home: { id: p[0], name: names[p[0]], crest: null },
      away: { id: p[1], name: names[p[1]], crest: null },
    }))
    .slice(0, limit);
}

export async function findMatch(matchId) {
  const matches = await getUpcomingMatches("FL1", 10);
  return matches.find((m) => m.id === String(matchId)) || null;
}
