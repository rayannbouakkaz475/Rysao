// ============================================================
//  Fournisseur API-Football.com (api-sports.io v3)
//  En-tête : x-apisports-key. IDs de ligue numériques.
//  Mappe les codes canoniques (FL1, PL, …) vers les IDs API-Football.
// ============================================================

import * as demo from "./demo";

const BASE_URL = "https://v3.football.api-sports.io";

// Code canonique -> ID de ligue API-Football
const LEAGUE_IDS = { FL1: 61, PL: 39, PD: 140, SA: 135, BL1: 78 };
// ID de ligue -> code canonique (pour retrouver la compétition d'un match)
const ID_TO_CODE = { 61: "FL1", 39: "PL", 140: "PD", 135: "SA", 78: "BL1" };

// Saison en cours (les championnats européens démarrent en août).
// Surchargeable via API_FOOTBALL_SEASON (utile selon ton offre/abonnement).
function season() {
  if (process.env.API_FOOTBALL_SEASON) return process.env.API_FOOTBALL_SEASON;
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return String(month >= 7 ? year : year - 1);
}

function roundNumber(round) {
  const m = /(\d+)/.exec(round || "");
  return m ? Number(m[1]) : null;
}

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`api-football ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  // API-Football renvoie parfois des erreurs avec un statut 200
  const errs = json.errors;
  const hasErr = Array.isArray(errs)
    ? errs.length > 0
    : errs && Object.keys(errs).length > 0;
  if (hasErr) {
    throw new Error(`api-football erreur: ${JSON.stringify(errs)}`);
  }
  return json;
}

function mapTeam(t) {
  return { id: t.id, name: t.name, crest: t.logo };
}

export async function getStandings(code) {
  const leagueId = LEAGUE_IDS[code];
  if (!leagueId) return demo.getStandings(code);
  try {
    const data = await apiFetch(
      `/standings?league=${leagueId}&season=${season()}`
    );
    const rows = data.response?.[0]?.league?.standings?.[0] || [];
    const table = {};
    for (const r of rows) {
      table[r.team.id] = {
        teamId: r.team.id,
        name: r.team.name,
        crest: r.team.logo,
        position: r.rank,
        playedGames: r.all?.played ?? 0,
        goalsFor: r.all?.goals?.for ?? 0,
        goalsAgainst: r.all?.goals?.against ?? 0,
        points: r.points,
        // API-Football donne la forme sans virgule ("WWDLW") -> on normalise
        form: r.form ? r.form.split("").join(",") : null,
      };
    }
    if (Object.keys(table).length === 0) return demo.getStandings(code);
    return { table, demo: false };
  } catch (e) {
    console.error("[api-football] standings fallback:", e.message);
    return demo.getStandings(code);
  }
}

export async function getUpcomingMatches(code, limit = 10) {
  const leagueId = LEAGUE_IDS[code];
  if (!leagueId) return demo.getUpcomingMatches(code, limit);
  try {
    const data = await apiFetch(
      `/fixtures?league=${leagueId}&season=${season()}&next=${limit}`
    );
    const matches = (data.response || []).map((f) => ({
      id: String(f.fixture.id),
      competition: code,
      utcDate: f.fixture.date,
      matchday: roundNumber(f.league?.round),
      home: mapTeam(f.teams.home),
      away: mapTeam(f.teams.away),
    }));
    if (matches.length === 0) return demo.getUpcomingMatches(code, limit);
    return matches;
  } catch (e) {
    console.error("[api-football] matches fallback:", e.message);
    return demo.getUpcomingMatches(code, limit);
  }
}

export async function findMatch(matchId) {
  // API-Football permet de récupérer un match par son ID directement.
  try {
    const data = await apiFetch(`/fixtures?id=${matchId}`);
    const f = data.response?.[0];
    if (!f) return null;
    const code = ID_TO_CODE[f.league?.id];
    if (!code) return null;
    return {
      id: String(f.fixture.id),
      competition: code,
      utcDate: f.fixture.date,
      matchday: roundNumber(f.league?.round),
      home: mapTeam(f.teams.home),
      away: mapTeam(f.teams.away),
    };
  } catch (e) {
    console.error("[api-football] findMatch error:", e.message);
    return null;
  }
}
