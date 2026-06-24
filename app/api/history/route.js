// GET /api/history?competition=<code>
// Back-test du modèle sur les derniers matchs TERMINÉS : compare le
// pronostic du modèle au résultat réel et calcule un taux de réussite.
//
// ⚠️ Indicatif : le back-test s'appuie sur le classement actuel, qui
// inclut déjà ces matchs (léger biais optimiste). C'est une mesure de
// cohérence du modèle, pas une garantie de performance future.

import { NextResponse } from "next/server";
import { getFinishedMatches, getStandings } from "@/lib/footballData";
import { predictMatch } from "@/lib/statModel";

export const dynamic = "force-dynamic";

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
    const [finished, standings] = await Promise.all([
      getFinishedMatches(competition, 20),
      getStandings(competition),
    ]);

    let total = 0;
    let ok1x2 = 0;
    let okScore = 0;
    const items = [];

    for (const m of finished) {
      if (m.goals.home == null || m.goals.away == null) continue;
      const home = standings.table[m.home.id] || neutralRow(m.home);
      const away = standings.table[m.away.id] || neutralRow(m.away);
      const pred = predictMatch(home, away);

      const actual =
        m.goals.home > m.goals.away
          ? "1"
          : m.goals.home === m.goals.away
          ? "N"
          : "2";
      const realScore = `${m.goals.home}-${m.goals.away}`;
      const correct1x2 = pred.pick.outcome === actual;
      const correctScore = pred.topScores[0].score === realScore;

      total += 1;
      if (correct1x2) ok1x2 += 1;
      if (correctScore) okScore += 1;

      items.push({
        id: m.id,
        home: m.home.name,
        away: m.away.name,
        realScore,
        actual,
        predicted: pred.pick.outcome,
        predictedScore: pred.topScores[0].score,
        correct1x2,
        correctScore,
      });
    }

    return NextResponse.json({
      competition,
      total,
      accuracy1x2: total ? Math.round((ok1x2 / total) * 100) : 0,
      accuracyScore: total ? Math.round((okScore / total) * 100) : 0,
      items,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
