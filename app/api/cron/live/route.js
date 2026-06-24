// GET /api/cron/live
// Sondé périodiquement (Vercel Cron). Récupère les matchs en direct,
// détecte les nouveaux événements (coup d'envoi, buts, cartons) et
// envoie une notification push aux abonnés qui SUIVENT ce match.
//
// Sécurité : protégé par CRON_SECRET (en-tête Authorization: Bearer ...).

import { NextResponse } from "next/server";
import { getLiveMatches } from "@/lib/footballData";
import { getLiveState, setLiveState, followersOf } from "@/lib/store";
import { broadcast, hasPush } from "@/lib/push";

export const dynamic = "force-dynamic";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // pas de secret configuré -> ouvert (dev)
  const auth = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

function eventKey(e) {
  return `${e.minute}-${e.type}-${e.detail}-${e.player}`;
}

function notifFor(e, fixture) {
  const score = `${fixture.goals.home ?? 0}-${fixture.goals.away ?? 0}`;
  if (e.type === "Goal") {
    return {
      title: `⚽ BUT ! ${fixture.home.name} ${score} ${fixture.away.name}`,
      body: `${e.player ?? "?"} (${e.team ?? ""}) ${e.minute}'`,
      url: "/",
    };
  }
  if (e.type === "Card") {
    const red = /red/i.test(e.detail || "");
    return {
      title: red ? "🟥 Carton rouge" : "🟨 Carton jaune",
      body: `${e.player ?? "?"} (${e.team ?? ""}) ${e.minute}' — ${fixture.home.name} ${score} ${fixture.away.name}`,
      url: "/",
    };
  }
  return null;
}

export async function GET(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!hasPush()) {
    return NextResponse.json({ ok: true, skipped: "VAPID non configuré" });
  }

  const live = await getLiveMatches();
  const state = getLiveState();
  let sent = 0;

  for (const fixture of live) {
    const followers = followersOf(fixture.id);
    if (followers.length === 0) continue;

    const fs = state.fixtures[fixture.id] || { seen: [], started: false };
    const notifs = [];

    // Coup d'envoi
    if (!fs.started && fixture.status && fixture.status !== "NS") {
      fs.started = true;
      notifs.push({
        title: "🟢 Coup d'envoi",
        body: `${fixture.home.name} – ${fixture.away.name} a commencé !`,
        url: "/",
      });
    }

    // Nouveaux événements (buts, cartons)
    for (const e of fixture.events) {
      const key = eventKey(e);
      if (fs.seen.includes(key)) continue;
      fs.seen.push(key);
      const n = notifFor(e, fixture);
      if (n) notifs.push(n);
    }

    state.fixtures[fixture.id] = fs;

    for (const n of notifs) {
      sent += await broadcast(followers, n);
    }
  }

  setLiveState(state);
  return NextResponse.json({ ok: true, liveMatches: live.length, sent });
}
