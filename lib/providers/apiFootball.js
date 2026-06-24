// ============================================================
//  Fournisseur API-Football.com (api-sports.io v3)
//  En-tête : x-apisports-key.
//  Couvre TOUTES les compétitions de ton abonnement (championnats,
//  coupes, Coupe du Monde…), récupérées dynamiquement.
//
//  Code de compétition utilisé dans l'app : "<leagueId>:<saison>"
//  (ex "61:2024" = Ligue 1 2024, "1:2026" = Coupe du Monde 2026).
// ============================================================

import * as demo from "./demo";

const BASE_URL = "https://v3.football.api-sports.io";

// Saison par défaut (championnats européens : départ en août).
function defaultSeason() {
  if (process.env.API_FOOTBALL_SEASON) return process.env.API_FOOTBALL_SEASON;
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return String(month >= 7 ? year : year - 1);
}

// "61:2024" -> { leagueId: 61, season: "2024" }
function parseCode(code) {
  const [id, s] = String(code).split(":");
  return { leagueId: Number(id), season: s || defaultSeason() };
}

function roundNumber(round) {
  const m = /(\d+)/.exec(round || "");
  return m ? Number(m[1]) : null;
}

async function apiFetch(path, revalidate = 300) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    next: { revalidate },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`api-football ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const errs = json.errors;
  const hasErr = Array.isArray(errs)
    ? errs.length > 0
    : errs && Object.keys(errs).length > 0;
  if (hasErr) throw new Error(`api-football erreur: ${JSON.stringify(errs)}`);
  return json;
}

function mapTeam(t) {
  return { id: t.id, name: t.name, crest: t.logo };
}

// --- Liste de TOUTES les compétitions actives (abonnement) ---
export async function getCompetitions() {
  try {
    // Cache 1h : la liste des ligues bouge rarement, ça ménage le quota.
    const data = await apiFetch(`/leagues?current=true`, 3600);
    const list = (data.response || []).map((item) => {
      const seasons = item.seasons || [];
      const current =
        seasons.find((s) => s.current) || seasons[seasons.length - 1];
      return {
        code: `${item.league.id}:${current?.year ?? defaultSeason()}`,
        leagueId: item.league.id,
        name: item.league.name,
        type: item.league.type, // "League" | "Cup"
        country: item.country?.name || "Monde",
        flag: item.country?.flag || null,
        logo: item.league.logo || null,
      };
    });
    // Tri : Coupe du Monde et compétitions internationales d'abord,
    // puis par pays, puis par nom.
    list.sort((a, b) => {
      const ai = isInternational(a) ? 0 : 1;
      const bi = isInternational(b) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      const c = a.country.localeCompare(b.country, "fr");
      if (c !== 0) return c;
      return a.name.localeCompare(b.name, "fr");
    });
    if (list.length === 0) return demo.getCompetitions();
    return list;
  } catch (e) {
    console.error("[api-football] competitions fallback:", e.message);
    return demo.getCompetitions();
  }
}

function isInternational(c) {
  return (
    c.leagueId === 1 || // World Cup
    /world|monde/i.test(c.country) ||
    /world cup|champions league|euro|nations|copa america|libertadores/i.test(
      c.name
    )
  );
}

// --- Classement (gère les poules : Coupe du Monde, coupes à groupes) ---
export async function getStandings(code) {
  const { leagueId, season } = parseCode(code);
  if (!leagueId) return { table: {}, demo: false };
  try {
    const data = await apiFetch(`/standings?league=${leagueId}&season=${season}`);
    // standings = tableau de groupes (1 pour un championnat, N pour des poules)
    const groups = data.response?.[0]?.league?.standings || [];
    const table = {};
    for (const group of groups) {
      for (const r of group) {
        table[r.team.id] = {
          teamId: r.team.id,
          name: r.team.name,
          crest: r.team.logo,
          position: r.rank,
          playedGames: r.all?.played ?? 0,
          goalsFor: r.all?.goals?.for ?? 0,
          goalsAgainst: r.all?.goals?.against ?? 0,
          points: r.points,
          form: r.form ? r.form.split("").join(",") : null,
        };
      }
    }
    return { table, demo: false };
  } catch (e) {
    console.error("[api-football] standings:", e.message);
    return { table: {}, demo: false };
  }
}

// --- Matchs à venir ---
export async function getUpcomingMatches(code, limit = 10) {
  const { leagueId, season } = parseCode(code);
  if (!leagueId) return [];
  try {
    const data = await apiFetch(
      `/fixtures?league=${leagueId}&season=${season}&next=${limit}`
    );
    return (data.response || []).map((f) => ({
      id: String(f.fixture.id),
      competition: code,
      utcDate: f.fixture.date,
      matchday: roundNumber(f.league?.round),
      round: f.league?.round || null,
      home: mapTeam(f.teams.home),
      away: mapTeam(f.teams.away),
    }));
  } catch (e) {
    console.error("[api-football] matches:", e.message);
    return [];
  }
}

// --- Récupération directe d'un match par son ID ---
export async function findMatch(matchId) {
  try {
    const data = await apiFetch(`/fixtures?id=${matchId}`);
    const f = data.response?.[0];
    if (!f) return null;
    return {
      id: String(f.fixture.id),
      competition: `${f.league.id}:${f.league.season}`,
      utcDate: f.fixture.date,
      matchday: roundNumber(f.league?.round),
      round: f.league?.round || null,
      home: mapTeam(f.teams.home),
      away: mapTeam(f.teams.away),
    };
  } catch (e) {
    console.error("[api-football] findMatch:", e.message);
    return null;
  }
}

// --- Matchs terminés (pour l'historique de réussite) ---
export async function getFinishedMatches(code, limit = 20) {
  const { leagueId, season } = parseCode(code);
  if (!leagueId) return [];
  try {
    const data = await apiFetch(
      `/fixtures?league=${leagueId}&season=${season}&last=${limit}`
    );
    return (data.response || [])
      .filter((f) => ["FT", "AET", "PEN"].includes(f.fixture?.status?.short))
      .map((f) => ({
        id: String(f.fixture.id),
        competition: code,
        utcDate: f.fixture.date,
        home: mapTeam(f.teams.home),
        away: mapTeam(f.teams.away),
        goals: { home: f.goals?.home, away: f.goals?.away },
      }));
  } catch (e) {
    console.error("[api-football] finished:", e.message);
    return [];
  }
}

// --- Cotes 1X2 de TOUS les bookmakers (comparateur) ---
export async function getOdds(fixtureId) {
  try {
    const data = await apiFetch(`/odds?fixture=${fixtureId}`, 1800);
    const bookmakers = data.response?.[0]?.bookmakers || [];
    const rows = [];
    for (const bk of bookmakers) {
      const bet = bk.bets?.find((b) => b.name === "Match Winner" || b.id === 1);
      if (!bet) continue;
      const val = (v) => {
        const o = bet.values.find((x) => x.value === v);
        return o ? Number(o.odd) : null;
      };
      const home = val("Home");
      const draw = val("Draw");
      const away = val("Away");
      if (home || draw || away) rows.push({ name: bk.name, home, draw, away });
    }
    if (rows.length === 0) return null;
    return { bookmakers: rows, best: bestOdds(rows) };
  } catch (e) {
    console.error("[api-football] odds:", e.message);
    return null;
  }
}

// Meilleure cote par issue (la plus élevée = la plus avantageuse au pari)
export function bestOdds(rows) {
  const best = {};
  for (const k of ["home", "draw", "away"]) {
    let top = null;
    for (const r of rows) {
      if (r[k] != null && (!top || r[k] > top.odd)) {
        top = { odd: r[k], bookmaker: r.name };
      }
    }
    best[k] = top;
  }
  return best;
}

// --- Matchs en direct + leurs événements (buts, cartons) ---
export async function getLiveMatches() {
  try {
    const data = await apiFetch(`/fixtures?live=all`, 0);
    return (data.response || []).map((f) => ({
      id: String(f.fixture.id),
      competition: `${f.league.id}:${f.league.season}`,
      status: f.fixture?.status?.short,
      elapsed: f.fixture?.status?.elapsed,
      home: mapTeam(f.teams.home),
      away: mapTeam(f.teams.away),
      goals: { home: f.goals?.home, away: f.goals?.away },
      events: (f.events || []).map((e) => ({
        type: e.type, // "Goal" | "Card" | "subst" | "Var"
        detail: e.detail, // "Normal Goal", "Yellow Card", "Red Card"...
        minute: e.time?.elapsed,
        team: e.team?.name,
        player: e.player?.name,
      })),
    }));
  } catch (e) {
    console.error("[api-football] live:", e.message);
    return [];
  }
}

// --- Compositions (confirmées ~1h avant le coup d'envoi) ---
export async function getLineups(fixtureId) {
  try {
    const data = await apiFetch(`/fixtures/lineups?fixture=${fixtureId}`, 300);
    const arr = data.response || [];
    if (arr.length === 0) return null;
    return arr.map((l) => ({
      teamId: l.team?.id,
      teamName: l.team?.name,
      formation: l.formation || null,
      coach: l.coach?.name || null,
      startXI: (l.startXI || []).map((e) => ({
        name: e.player?.name,
        number: e.player?.number,
        pos: e.player?.pos,
      })),
    }));
  } catch (e) {
    console.error("[api-football] lineups:", e.message);
    return null;
  }
}

// --- Meilleurs buteurs d'une compétition ---
export async function getTopScorers(code) {
  const { leagueId, season } = parseCode(code);
  if (!leagueId) return [];
  try {
    // Cache 30 min : le classement des buteurs évolue lentement.
    const data = await apiFetch(
      `/players/topscorers?league=${leagueId}&season=${season}`,
      1800
    );
    return (data.response || [])
      .map((item) => {
        const st = item.statistics?.[0] || {};
        return {
          playerId: item.player?.id,
          name: item.player?.name,
          photo: item.player?.photo || null,
          teamId: st.team?.id,
          teamName: st.team?.name,
          goals: st.goals?.total ?? 0,
        };
      })
      .filter((p) => p.teamId);
  } catch (e) {
    console.error("[api-football] topscorers:", e.message);
    return [];
  }
}
