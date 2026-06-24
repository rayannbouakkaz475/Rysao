// ============================================================
//  Fournisseur football-data.org (v4)
//  Les codes canoniques (FL1, PL, PD, SA, BL1) sont identiques
//  aux codes football-data.org — aucun mapping nécessaire.
// ============================================================

import * as demo from "./demo";

const BASE_URL = "https://api.football-data.org/v4";

// Compétitions disponibles sur football-data.org (codes officiels).
const COMPS = [
  { code: "WC", name: "Coupe du Monde", type: "Cup", country: "Monde", flag: null, logo: null },
  { code: "CL", name: "Ligue des Champions", type: "Cup", country: "Europe", flag: null, logo: null },
  { code: "EC", name: "Championnat d'Europe", type: "Cup", country: "Europe", flag: null, logo: null },
  { code: "PL", name: "Premier League", type: "League", country: "Angleterre", flag: null, logo: null },
  { code: "PD", name: "La Liga", type: "League", country: "Espagne", flag: null, logo: null },
  { code: "SA", name: "Serie A", type: "League", country: "Italie", flag: null, logo: null },
  { code: "BL1", name: "Bundesliga", type: "League", country: "Allemagne", flag: null, logo: null },
  { code: "FL1", name: "Ligue 1", type: "League", country: "France", flag: null, logo: null },
  { code: "DED", name: "Eredivisie", type: "League", country: "Pays-Bas", flag: null, logo: null },
  { code: "PPL", name: "Primeira Liga", type: "League", country: "Portugal", flag: null, logo: null },
  { code: "ELC", name: "Championship", type: "League", country: "Angleterre", flag: null, logo: null },
  { code: "BSA", name: "Brasileirão", type: "League", country: "Brésil", flag: null, logo: null },
];

export async function getCompetitions() {
  return COMPS;
}

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function getStandings(code) {
  try {
    const data = await apiFetch(`/competitions/${code}/standings`);
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
        form: row.form,
      };
    }
    return { table, demo: false };
  } catch (e) {
    console.error("[football-data] standings fallback:", e.message);
    return demo.getStandings(code);
  }
}

export async function getUpcomingMatches(code, limit = 10) {
  try {
    const data = await apiFetch(`/competitions/${code}/matches?status=SCHEDULED`);
    return (data.matches || []).slice(0, limit).map((m) => ({
      id: String(m.id),
      competition: code,
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
    console.error("[football-data] matches fallback:", e.message);
    return demo.getUpcomingMatches(code, limit);
  }
}

export async function getFinishedMatches(code, limit = 20) {
  try {
    const data = await apiFetch(`/competitions/${code}/matches?status=FINISHED`);
    const all = data.matches || [];
    return all
      .slice(-limit)
      .reverse()
      .map((m) => ({
        id: String(m.id),
        competition: code,
        utcDate: m.utcDate,
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
        goals: {
          home: m.score?.fullTime?.home,
          away: m.score?.fullTime?.away,
        },
      }));
  } catch (e) {
    console.error("[football-data] finished:", e.message);
    return [];
  }
}

// football-data.org ne fournit pas de cotes ni de compositions.
export async function getOdds() {
  return null;
}
export async function getLineups() {
  return null;
}

export async function getTopScorers(code) {
  try {
    const data = await apiFetch(`/competitions/${code}/scorers?limit=50`);
    return (data.scorers || [])
      .map((s) => ({
        playerId: s.player?.id,
        name: s.player?.name,
        photo: null,
        teamId: s.team?.id,
        teamName: s.team?.shortName || s.team?.name,
        goals: s.goals ?? s.numberOfGoals ?? 0,
      }))
      .filter((p) => p.teamId);
  } catch (e) {
    console.error("[football-data] scorers:", e.message);
    return [];
  }
}

export async function findMatch(matchId) {
  for (const c of COMPS) {
    const matches = await getUpcomingMatches(c.code, 20);
    const found = matches.find((m) => m.id === String(matchId));
    if (found) return found;
  }
  return null;
}
