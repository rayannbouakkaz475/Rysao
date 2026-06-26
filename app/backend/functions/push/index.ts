// ===========================================================================
// RYSAO TCG — Edge Function "push" (Supabase / Deno)
// Reçoit { table, record } depuis un trigger DB (bids | messages), trouve le
// destinataire et lui envoie une Web Push à tous ses abonnements.
//
// Déploiement :
//   supabase functions deploy push --no-verify-jwt
//   supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... \
//     PUSH_SHARED_SECRET=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
// Génère les clés VAPID :  npx web-push generate-vapid-keys
// ===========================================================================
import webpush from "https://esm.sh/web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const SHARED = Deno.env.get("PUSH_SHARED_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
webpush.setVapidDetails("mailto:admin@rysao.app", VAPID_PUBLIC, VAPID_PRIVATE);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  // Secret partagé (défini aussi dans le trigger SQL notify_push)
  if (SHARED && req.headers.get("x-rysao-secret") !== SHARED) return json({ error: "unauthorized" }, 401);

  let body: { table?: string; record?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const { table, record } = body;
  if (!table || !record) return json({ ok: true });

  let targetUserId: string | null = null;
  let payload: { title: string; body: string; url: string; tag?: string } | null = null;

  if (table === "bids") {
    const { data: post } = await supabase.from("posts").select("author_id, body").eq("id", record.post_id).single();
    if (!post) return json({ ok: true });
    targetUserId = post.author_id as string;
    payload = { title: "Nouvelle enchère 🔨", body: `${record.bidder} a misé ${record.amount} sur ta publication`, url: "./index.html", tag: `bid-${record.post_id}` };
  } else if (table === "messages") {
    const { data: prof } = await supabase.from("profiles").select("id").eq("username", record.recipient_name).single();
    if (!prof) return json({ ok: true });
    targetUserId = prof.id as string;
    payload = { title: "Nouveau message 💬", body: `${record.sender_name}: ${record.body}`, url: "./index.html", tag: `msg-${record.sender_name}` };
  } else {
    return json({ ok: true });
  }

  const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", targetUserId);
  if (!subs?.length) return json({ ok: true, sent: 0 });

  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      // Abonnement expiré -> nettoyage
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }));

  return json({ ok: true, sent });
});
