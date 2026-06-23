// GET /api/matches?competition=FL1
// Renvoie les matchs à venir + la prédiction statistique de chacun.

import { NextResponse } from "next/server";
import { getUpcomingMatches, getStandings } from "@/lib/footballData";
import { predictMatch } from "@/lib/statModel";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const competition = searchParams.get("competition");

  if (!competition) {
    return NextResponse.json(
      { error: "Paramètre 'competition' requis" },
      { status: 400 }
    );
  }

  try {
    const [matches, standings] = await Promise.all([
      getUpcomingMatches(competition, 10),
      getStandings(competition),
    ]);

    const enriched = matches.map((m) => {
      const home = standings.table[m.home.id];
      const away = standings.table[m.away.id];
      // Si une équipe manque au classement (promu, données partielles), on
      // fournit une ligne neutre pour ne pas casser le modèle.
      const homeRow = home || neutralRow(m.home);
      const awayRow = away || neutralRow(m.away);
      return { ...m, prediction: predictMatch(homeRow, awayRow) };
    });

    return NextResponse.json({
      competition,
      demo: standings.demo,
      matches: enriched,
    });
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
