// POST /api/predict  { matchId }
// Renvoie l'analyse IA détaillée (Claude + modèle stats) d'un match.

import { NextResponse } from "next/server";
import { findMatch, getStandings, getTopScorers } from "@/lib/footballData";
import { predictMatch } from "@/lib/statModel";
import { predictScorers } from "@/lib/scorers";
import { analyzeMatch } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { matchId } = body || {};
  if (!matchId) {
    return NextResponse.json({ error: "matchId requis" }, { status: 400 });
  }

  try {
    const match = await findMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
    }

    const standings = await getStandings(match.competition);
    const home = standings.table[match.home.id] || neutralRow(match.home);
    const away = standings.table[match.away.id] || neutralRow(match.away);

    const prediction = predictMatch(home, away);

    const topScorers = await getTopScorers(match.competition);
    const scorers = predictScorers(match, prediction, topScorers);

    const { analysis, source } = await analyzeMatch(
      match,
      prediction,
      standings,
      scorers
    );

    return NextResponse.json({ match, prediction, scorers, analysis, source });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

function neutralRow(team) {
  return {
    teamId: team.id,
    name: team.name,
    position: 10,
    playedGames: 10,
    goalsFor: 14,
    goalsAgainst: 14,
    points: 13,
    form: "D,D,D,D,D",
  };
}
