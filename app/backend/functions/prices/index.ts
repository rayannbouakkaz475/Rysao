// ===========================================================================
// RYSAO Cards — Edge Function "prices" (Supabase / Deno)
// Proxy SÉCURISÉ des sources de prix payantes : les clés restent côté serveur.
// L'app appelle cette fonction ; la fonction appelle PriceCharting + Cardmarket
// et renvoie un format UNIFIÉ en EUR.
//
// Déploiement :
//   supabase functions deploy prices --no-verify-jwt
//   supabase secrets set \
//     PRICECHARTING_TOKEN=...  \
//     FX_USD_EUR=0.92          \
//     CM_APP_TOKEN=... CM_APP_SECRET=... CM_ACCESS_TOKEN=... CM_ACCESS_SECRET=...
//
// Requête : GET ?q=<nom>&game=<jeu>&type=raw|graded|sealed&grade=<ex: "PSA 10">
// Réponse : { ok, query, matched, source, raw:{...}, graded:{...}, sealed }
//           (tous les montants en EUR)
// ===========================================================================

const PC_TOKEN = Deno.env.get("PRICECHARTING_TOKEN") ?? "";
const FX = parseFloat(Deno.env.get("FX_USD_EUR") ?? "0.92");           // USD -> EUR
const CM = {
  appToken: Deno.env.get("CM_APP_TOKEN") ?? "",
  appSecret: Deno.env.get("CM_APP_SECRET") ?? "",
  accToken: Deno.env.get("CM_ACCESS_TOKEN") ?? "",
  accSecret: Deno.env.get("CM_ACCESS_SECRET") ?? "",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: CORS });
const usd2eur = (cents: number | null | undefined) => (cents == null ? null : +(cents / 100 * FX).toFixed(2));

/* ----------------- PriceCharting ----------------- */
// Mapping cartes (champs en cents USD) -> notes.
// Réf. doc PriceCharting "API: trading cards".
function pcGradeField(grade: string): string {
  const g = grade.toUpperCase();
  if (g.includes("BGS") && g.includes("10")) return "bgs-10-price";
  if (g.includes("CGC") && g.includes("10")) return "condition-17-price";
  if (g.includes("SGC") && g.includes("10")) return "condition-18-price";
  if (g.includes("10")) return "manual-only-price";  // PSA 10
  if (g.includes("9.5")) return "box-only-price";    // grade 9.5
  if (g.includes("9")) return "graded-price";        // grade 9
  if (g.includes("8")) return "new-price";           // grade 8
  if (g.includes("7")) return "cib-price";           // grade 7
  return "graded-price";
}

async function pricecharting(q: string, type: string, grade: string) {
  if (!PC_TOKEN) return null;
  const r = await fetch(`https://www.pricecharting.com/api/product?t=${PC_TOKEN}&q=${encodeURIComponent(q)}`);
  if (!r.ok) return null;
  const d = await r.json();
  if (!d || d.status === "error" || !d["product-name"]) return null;
  const matched = `${d["product-name"]}${d["console-name"] ? " — " + d["console-name"] : ""}`;
  if (type === "graded") return { matched, value: usd2eur(d[pcGradeField(grade)]) };
  if (type === "sealed") return { matched, value: usd2eur(d["new-price"]) };
  return { matched, loose: usd2eur(d["loose-price"]), psa10: usd2eur(d["manual-only-price"]) };
}

/* ----------------- Cardmarket (OAuth1) ----------------- */
async function hmacSha1(key: string, base: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(base));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
const enc = (s: string) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

async function cmAuthHeader(method: string, url: string): Promise<string> {
  const oauth: Record<string, string> = {
    oauth_consumer_key: CM.appToken, oauth_token: CM.accToken,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_signature_method: "HMAC-SHA1", oauth_version: "1.0",
  };
  const params = Object.keys(oauth).sort().map((k) => `${enc(k)}=${enc(oauth[k])}`).join("&");
  const base = `${method.toUpperCase()}&${enc(url)}&${enc(params)}`;
  oauth.oauth_signature = await hmacSha1(`${enc(CM.appSecret)}&${enc(CM.accSecret)}`, base);
  const header = Object.keys(oauth).map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(", ");
  return `OAuth realm="${url}", ${header}`;
}

async function cardmarket(q: string): Promise<number | null> {
  if (!CM.appToken || !CM.appSecret || !CM.accToken || !CM.accSecret) return null;
  try {
    const findUrl = "https://api.cardmarket.com/ws/v2.0/output.json/products/find";
    const full = `${findUrl}?search=${enc(q)}&exact=false&start=0&maxResults=1`;
    const r = await fetch(full, { headers: { Authorization: await cmAuthHeader("GET", findUrl) } });
    if (!r.ok) return null;
    const d = await r.json();
    const prod = d.product && (Array.isArray(d.product) ? d.product[0] : d.product);
    const pg = prod && (prod.priceGuide || prod.priceGuideEUR);
    const avg = pg && (pg.AVG ?? pg.AVG7 ?? pg.TREND);
    return avg != null ? +(+avg).toFixed(2) : null;
  } catch { return null; }
}

/* ----------------- Handler ----------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim();
  const type = u.searchParams.get("type") || "raw";
  const grade = u.searchParams.get("grade") || "";
  if (!q) return json({ ok: false, error: "missing q" }, 400);

  const [pc, cmAvg] = await Promise.all([pricecharting(q, type, grade), cardmarket(q)]);
  const matched = (pc && pc.matched) || q;
  const sources = [PC_TOKEN ? "PriceCharting" : null, cmAvg != null ? "Cardmarket" : null].filter(Boolean).join(" + ");

  if (type === "graded") {
    return json({ ok: true, query: q, matched, source: sources || "—",
      graded: { value: pc ? pc.value : null, grade } });
  }
  if (type === "sealed") {
    return json({ ok: true, query: q, matched, source: sources || "—",
      sealed: pc ? pc.value : null });
  }
  // raw
  const cardmarketEur = cmAvg;
  const pricechartingEur = pc ? pc.loose : null;
  const vals = [cardmarketEur, pricechartingEur].filter((v): v is number => v != null);
  const avg = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
  if (avg == null) return json({ ok: false, error: "no_price", query: q, matched });
  return json({ ok: true, query: q, matched, source: sources || "—",
    raw: { cardmarket: cardmarketEur, tcgplayer: null, pricecharting: pricechartingEur,
           avg, low: +(avg * 0.7).toFixed(2), high: +(avg * 1.4).toFixed(2) } });
});
