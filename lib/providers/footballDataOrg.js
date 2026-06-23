// ============================================================
//  Fournisseur football-data.org (v4)
//  Les codes canoniques (FL1, PL, PD, SA, BL1) sont identiques
//  aux codes football-data.org — aucun mapping nécessaire.
// ============================================================

import * as demo from "./demo";

const BASE_URL = "https://api.football-data.org/v4";

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

export async function findMatch(matchId, competitions) {
  for (const c of competitions) {
    const matches = await getUpcomingMatches(c.code, 20);
    const found = matches.find((m) => m.id === String(matchId));
    if (found) return found;
  }
  return null;
}
