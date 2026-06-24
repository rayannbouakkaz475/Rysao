// POST -> suivre / ne plus suivre un match  { endpoint, fixtureId, follow }

import { NextResponse } from "next/server";
import { setFollow } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const { endpoint, fixtureId, follow } = body || {};
  if (!endpoint || !fixtureId) {
    return NextResponse.json(
      { error: "endpoint et fixtureId requis" },
      { status: 400 }
    );
  }
  const ok = setFollow(endpoint, String(fixtureId), follow !== false);
  if (!ok) {
    return NextResponse.json(
      { error: "Abonnement introuvable" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, following: follow !== false });
}
