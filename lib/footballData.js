// ============================================================
//  Répartiteur de données football (multi-fournisseurs)
//  Choisit automatiquement le client selon les clés présentes :
//    1. API_FOOTBALL_KEY    -> API-Football.com
//    2. FOOTBALL_DATA_TOKEN -> football-data.org
//    3. (rien)              -> données de démo
// ============================================================

import * as demo from "./providers/demo";
import * as footballDataOrg from "./providers/footballDataOrg";
import * as apiFootball from "./providers/apiFootball";

export function activeProviderName() {
  if (process.env.API_FOOTBALL_KEY) return "api-football";
  if (process.env.FOOTBALL_DATA_TOKEN) return "football-data";
  return "demo";
}

function provider() {
  if (process.env.API_FOOTBALL_KEY) return apiFootball;
  if (process.env.FOOTBALL_DATA_TOKEN) return footballDataOrg;
  return demo;
}

export async function getCompetitions() {
  return provider().getCompetitions();
}

export async function getStandings(code) {
  return provider().getStandings(code);
}

export async function getUpcomingMatches(code, limit = 10) {
  return provider().getUpcomingMatches(code, limit);
}

export async function findMatch(matchId) {
  return provider().findMatch(matchId);
}

export async function getTopScorers(code) {
  return provider().getTopScorers(code);
}
