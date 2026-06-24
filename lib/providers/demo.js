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

export async function getCompetitions() {
  return [
    { code: "FL1", name: "Ligue 1", type: "League", country: "France", flag: null, logo: null },
    { code: "PL", name: "Premier League", type: "League", country: "Angleterre", flag: null, logo: null },
    { code: "PD", name: "La Liga", type: "League", country: "Espagne", flag: null, logo: null },
    { code: "SA", name: "Serie A", type: "League", country: "Italie", flag: null, logo: null },
    { code: "BL1", name: "Bundesliga", type: "League", country: "Allemagne", flag: null, logo: null },
  ];
}

export async function getFinishedMatches() {
  const names = {};
  for (const t of TEAMS) names[t.teamId] = t.name;
  const now = Date.now();
  const day = 86400000;
  // Matchs passés fictifs avec scores
  const fixtures = [
    [1, 4, 3, 0], [2, 5, 2, 1], [3, 6, 1, 1], [7, 9, 2, 0], [10, 8, 0, 2],
    [4, 2, 1, 2], [5, 1, 0, 3], [6, 7, 2, 1], [8, 3, 1, 1], [9, 10, 1, 0],
  ];
  return fixtures.map((f, i) => ({
    id: `demo-fin-${i + 1}`,
    competition: "FL1",
    utcDate: new Date(now - (i + 1) * day).toISOString(),
    home: { id: f[0], name: names[f[0]], crest: null },
    away: { id: f[1], name: names[f[1]], crest: null },
    goals: { home: f[2], away: f[3] },
  }));
}

export async function getOdds() {
  const bookmakers = [
    { name: "Bookmaker A", home: 1.45, draw: 4.6, away: 7.5 },
    { name: "Bookmaker B", home: 1.5, draw: 4.4, away: 8.0 },
    { name: "Bookmaker C", home: 1.48, draw: 4.75, away: 7.2 },
  ];
  return {
    bookmakers,
    best: {
      home: { odd: 1.5, bookmaker: "Bookmaker B" },
      draw: { odd: 4.75, bookmaker: "Bookmaker C" },
      away: { odd: 8.0, bookmaker: "Bookmaker B" },
    },
  };
}

export async function getLiveMatches() {
  return []; // pas de direct en démo
}

function demoXI(formation) {
  const lines = formation.split("-").map(Number);
  const xi = [{ name: "Gardien", number: 1, pos: "G" }];
  let n = 2;
  const posByLine = ["D", "M", "A"];
  lines.forEach((count, li) => {
    for (let i = 0; i < count; i++) {
      xi.push({ name: `Joueur ${n}`, number: n, pos: posByLine[li] || "M" });
      n++;
    }
  });
  return xi;
}

export async function getLineups() {
  return [
    { teamId: null, teamName: "Domicile (démo)", formation: "4-3-3", coach: "Entraîneur A", startXI: demoXI("4-3-3") },
    { teamId: null, teamName: "Extérieur (démo)", formation: "4-2-3-1", coach: "Entraîneur B", startXI: demoXI("4-5-1") },
  ];
}

export async function getTopScorers() {
  // Buteurs fictifs (ids alignés sur le classement de démo).
  return [
    { playerId: 101, name: "K. Mbappé", teamId: 1, teamName: "Paris SG", goals: 12, photo: null },
    { playerId: 102, name: "O. Dembélé", teamId: 1, teamName: "Paris SG", goals: 7, photo: null },
    { playerId: 103, name: "F. Balogun", teamId: 2, teamName: "Monaco", goals: 8, photo: null },
    { playerId: 104, name: "P. Aubameyang", teamId: 3, teamName: "Marseille", goals: 9, photo: null },
    { playerId: 105, name: "J. David", teamId: 4, teamName: "Lille", goals: 8, photo: null },
    { playerId: 106, name: "A. Lacazette", teamId: 5, teamName: "Lyon", goals: 7, photo: null },
    { playerId: 107, name: "G. Laborde", teamId: 6, teamName: "Nice", goals: 5, photo: null },
    { playerId: 108, name: "F. Sotoca", teamId: 7, teamName: "Lens", goals: 5, photo: null },
    { playerId: 109, name: "A. Kalimuendo", teamId: 8, teamName: "Rennes", goals: 6, photo: null },
    { playerId: 110, name: "M. Mohamed", teamId: 9, teamName: "Nantes", goals: 4, photo: null },
    { playerId: 111, name: "A. Kitala", teamId: 10, teamName: "Le Havre", goals: 3, photo: null },
  ];
}

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
