// GET    -> clé publique VAPID (pour s'abonner côté navigateur)
// POST   -> enregistre un abonnement push  { subscription }
// DELETE -> supprime un abonnement          { endpoint }

import { NextResponse } from "next/server";
import { saveSubscription, removeSubscription } from "@/lib/store";
import { hasPush } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    enabled: hasPush(),
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.keys) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }
  await saveSubscription(sub);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const body = await request.json().catch(() => null);
  if (!body?.endpoint) {
    return NextResponse.json({ error: "endpoint requis" }, { status: 400 });
  }
  await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
