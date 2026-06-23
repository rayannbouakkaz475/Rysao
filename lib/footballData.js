// ============================================================
//  Client football-data.org (v4)
//  Récupère matchs à venir et classements pour un championnat.
//  Repli automatique sur des données de démo si pas de token.
// ============================================================

const BASE_URL = "https://api.football-data.org/v4";

// Championnats supportés (codes football-data.org)
export const COMPETITIONS = [
  { code: "PL", name: "Premier League", flag: "🏴" },
  { code: "PD", name: "La Liga", flag: "🇪🇸" },
  { code: "SA", name: "Serie A", flag: "🇮🇹" },
  { code: "BL1", name: "Bundesliga", flag: "🇩🇪" },
  { code: "FL1", name: "Ligue 1", flag: "🇫🇷" },
];

function hasToken() {
  return Boolean(process.env.FOOTBALL_DATA_TOKEN);
}

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN },
    // Cache 5 min côté Next pour ménager le quota gratuit (10 req/min)
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// --- Classement -> table indexée par id d'équipe ---
export async function getStandings(competitionCode) {
  if (!hasToken()) return demoStandings(competitionCode);
  try {
    const data = await apiFetch(`/competitions/${competitionCode}/standings`);
    const total = (data.standings || []).find((s) => s.type === "TOTAL");
    const table = {};
    for (const row of total?.table || []) {
      table[row.team.id] = {
        teamId: row.team.id,
        name: row.team.shortName || row.team.name,
        crest: row.team.crest,
        position: row.position,
        playedGames: row.playedGames,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        points: row.points,
        form: row.form, // ex "W,D,L,W,W"
      };
    }
    return { table, demo: false };
  } catch (e) {
    console.error("getStandings fallback:", e.message);
    return demoStandings(competitionCode);
  }
}

// --- Matchs à venir ---
export async function getUpcomingMatches(competitionCode, limit = 10) {
  if (!hasToken()) return demoMatches(competitionCode).slice(0, limit);
  try {
    const data = await apiFetch(
      `/competitions/${competitionCode}/matches?status=SCHEDULED`
    );
    return (data.matches || [])
      .slice(0, limit)
      .map((m) => ({
        id: String(m.id),
        competition: competitionCode,
        utcDate: m.utcDate,
        matchday: m.matchday,
        home: {
          id: m.homeTeam.id,
          name: m.homeTeam.shortName || m.homeTeam.name,
          crest: m.homeTeam.crest,
        },
        away: {
          id: m.awayTeam.id,
          name: m.awayTeam.shortName || m.awayTeam.name,
          crest: m.awayTeam.crest,
        },
      }));
  } catch (e) {
    console.error("getUpcomingMatches fallback:", e.message);
    return demoMatches(competitionCode).slice(0, limit);
  }
}

// Trouve un match par id (parcourt les championnats)
export async function findMatch(matchId) {
  for (const c of COMPETITIONS) {
    const matches = await getUpcomingMatches(c.code, 20);
    const found = matches.find((m) => m.id === String(matchId));
    if (found) return found;
  }
  return null;
}

// ============================================================
//  Données de démo (sans token) — Ligue 1 fictive
// ============================================================
function demoStandings() {
  const teams = [
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
  const table = {};
  for (const t of teams) table[t.teamId] = { ...t, crest: null };
  return { table, demo: true };
}

function demoMatches() {
  const now = Date.now();
  const day = 86400000;
  const pairs = [
    [1, 3], [2, 4], [5, 6], [7, 8], [9, 10],
    [3, 2], [4, 5], [1, 6], [8, 9], [10, 7],
  ];
  const names = demoStandings().table;
  return pairs.map((p, i) => ({
    id: `demo-${i + 1}`,
    competition: "FL1",
    utcDate: new Date(now + (i + 1) * day).toISOString(),
    matchday: 11,
    home: { id: p[0], name: names[p[0]].name, crest: null },
    away: { id: p[1], name: names[p[1]].name, crest: null },
  }));
}
