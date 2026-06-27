/* ===========================================================================
   RYSAO TCG — Moteur : gradation, prix, devises, mises à jour de sorties
   =========================================================================== */

/* ---------- Devises ---------- */
function getCurrency() {
  const code = localStorage.getItem("rysao_currency") || "EUR";
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}
function setCurrency(code) { localStorage.setItem("rysao_currency", code); }
function fmtMoney(eurValue) {
  const c = getCurrency();
  const v = eurValue * c.rate;
  const dec = (c.code === "JPY") ? 0 : 2;
  const n = v.toLocaleString(CURRENT_LANG, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (c.code === "USD" || c.code === "CAD" || c.code === "GBP") ? `${c.symbol}${n}` : `${n} ${c.symbol}`;
}

/* ---------- Gradation : probabilité d'une grosse note ----------
   Entrées : centeringScore 0..1, surfaceScore 0..1 (état/surface estimé).
   Sortie par société : { proba (0..100), predicted (note prédite) }
*/
function estimateGrades(centeringScore, surfaceScore) {
  const cs = Math.max(0, Math.min(1, centeringScore));
  const ss = Math.max(0, Math.min(1, surfaceScore != null ? surfaceScore : centeringScore));
  // base composite : le centrage pèse fort pour les hautes notes
  const composite = cs * 0.55 + ss * 0.45;
  return GRADING_COMPANIES.map((co) => {
    // société stricte => exigence plus haute pour la grosse note
    const proba = Math.round(Math.max(0, Math.min(100,
      (composite * 100) * co.strict - (1 - composite) * 12)));
    // note prédite (échelle /10)
    let predicted = 6 + composite * 4; // 6..10
    predicted = Math.round(predicted * 2) / 2; // demi-points
    predicted = Math.min(10, Math.max(1, predicted));
    return { ...co, proba, predicted };
  }).sort((a, b) => b.proba - a.proba);
}

/* ---------- Centrage référencé à TOUTES les maisons de gradation ----------
   À partir du ratio mesuré (centerLR/centerTB ∈ 0..1), calcule pour chaque
   société la note MAX atteignable par le seul centrage, selon son barème.
*/
function worstCenterPct(centerLR, centerTB) {
  const lr = Math.max(centerLR, 1 - centerLR) * 100;
  const tb = Math.max(centerTB, 1 - centerTB) * 100;
  return Math.round(Math.max(lr, tb));
}
function centeringMaxGradeFor(companyName, worstPct) {
  const ladder = centeringStandardFor(companyName); // [[grade, tol], ...] note décroissante
  for (const [g, tol] of ladder) if (worstPct <= tol) return g;
  const last = ladder[ladder.length - 1];
  return `<${last[0]}`;
}
function centeringByHouses(centerLR, centerTB) {
  const worst = worstCenterPct(centerLR, centerTB);
  return GRADING_COMPANIES.map((co) => ({
    name: co.name, region: co.region, country: co.country,
    maxGrade: centeringMaxGradeFor(co.name, worst),
  }));
}

function gradeVerdict(centeringScore) {
  if (centeringScore >= 0.85) return { key: "grade_excellent", cls: "ok" };
  if (centeringScore >= 0.65) return { key: "grade_good", cls: "good" };
  if (centeringScore >= 0.45) return { key: "grade_fair", cls: "warn" };
  return { key: "grade_poor", cls: "bad" };
}

/* ---------- Prix marché (estimation) ----------
   Sans clé API, on génère une estimation déterministe et stable par carte,
   étiquetée comme estimation. PRICE_API_KEY permet de brancher du live.
*/
const PRICE_API_KEY = localStorage.getItem("rysao_price_api") || null;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

async function getPrice(query, game) {
  // 1) Prix RÉEL via fournisseurs (Cardmarket through pokemontcg.io, etc.)
  if (window.Providers && Providers.getLivePrice) {
    try {
      const live = await Providers.getLivePrice(query, game);
      if (live) return live;
    } catch (_) { /* repli estimation */ }
  }
  // 2) Repli : estimation déterministe stable, étiquetée comme telle.
  const h = hashStr(query.toLowerCase().trim());
  const base = 2 + (h % 4000) / 10;            // 2 .. ~402 EUR
  const spread = 0.15 + ((h >> 5) % 40) / 100; // 15% .. 55%
  const cm = base * (1 + (((h >> 3) % 20) - 10) / 100);
  const ebay = base * (1 + (((h >> 7) % 24) - 12) / 100);
  const avg = (cm + ebay) / 2;
  const tcg = base * (1 + (((h >> 11) % 22) - 11) / 100);
  const trend = (((h >> 9) % 41) - 20);        // -20% .. +20%
  return {
    query,
    estimate: true,
    cardmarket: { avg: +cm.toFixed(2) },
    tcgplayer: { avg: +tcg.toFixed(2) },
    ebay: { avg: +ebay.toFixed(2), estimate: true },
    avg: +avg.toFixed(2),
    low: +(avg * (1 - spread)).toFixed(2),
    high: +(avg * (1 + spread)).toFixed(2),
    trend,
    links: (window.Providers && Providers.marketLinks) ? Providers.marketLinks(query) : null,
  };
}

/* ---------- Prix des cartes GRADÉES ----------
   Pas d'API gratuite fiable pour les ventes gradées : on estime une valeur à
   partir du prix brut × multiplicateur par société/note, ET on fournit les
   liens vers les ventes RÉELLES (eBay vendus, PriceCharting, PSA APR, 130point).
*/
const GRADE_MULTIPLIERS = {
  // note (sur 10) -> multiplicateur indicatif appliqué au prix brut (profil Équilibré)
  "10": 5.0, "9.5": 2.6, "9": 1.8, "8.5": 1.4, "8": 1.2,
  "7.5": 1.05, "7": 0.95, "6.5": 0.85, "6": 0.78, "5": 0.65,
  "4": 0.55, "3": 0.45, "2": 0.38, "1": 0.30,
};
// Certaines sociétés ont une prime/décote de marché sur la note haute.
const GRADER_FACTOR = { PSA: 1.0, BGS: 1.05, BECKETT: 1.05, CGC: 0.9, SGC: 0.95, PCA: 0.85, AFG: 0.8, MGC: 0.8, TAG: 0.9, ARS: 0.85, GMA: 0.6, GRADIA: 0.8 };

async function getGradedPrice(query, game, company, grade) {
  // 1) Prix gradé RÉEL via Edge Function (PriceCharting) si configurée
  if (window.Providers && Providers.getPaidGraded) {
    try { const paid = await Providers.getPaidGraded(query, game, company, grade); if (paid) return paid; }
    catch (_) { /* repli estimation */ }
  }
  // 2) Repli : estimation prix brut × note × société
  const raw = await getPrice(query, game);             // prix brut (réel ou estimé)
  const g = String(grade || "").replace(",", ".");
  const mult = GRADE_MULTIPLIERS[g] || 1;
  const gf = GRADER_FACTOR[(company || "").toUpperCase()] || 1;
  const value = +(raw.avg * mult * gf).toFixed(2);
  return {
    query, company: company || "—", grade: g || "—",
    rawAvg: raw.avg, estimate: true,           // valeur gradée = estimation
    value, low: +(value * 0.7).toFixed(2), high: +(value * 1.5).toFixed(2),
    rawSource: raw.estimate ? "estimation" : (raw.source || "réel"),
    links: (window.Providers && Providers.marketLinks)
      ? Providers.marketLinks(query, { graded: true, company, grade: g }) : null,
  };
}

/* ---------- Système de mise à jour des sorties ----------
   Calendrier des sorties à venir. Au lancement, on ajoute automatiquement au
   catalogue toute sortie dont la date est atteinte et absente du catalogue.
   En production, RELEASE_FEED_URL peut pointer vers un JSON distant.
*/
const RELEASE_FEED_URL = null; // ex: "https://ton-backend/releases.json"

const RELEASE_CALENDAR = [
  { game: "Pokémon", name: "SV Destinées de Paldea", code: "PAF", year: 2024, cards: 245, langs: ["en","fr","de","it","ja","zh"], date: "2024-01-26" },
  { game: "Pokémon", name: "SV Forces Temporelles", code: "TEF", year: 2024, cards: 218, langs: ["en","fr","de","it","ja","zh"], date: "2024-03-22" },
  { game: "Pokémon", name: "SV Couronne Stellaire", code: "SCR", year: 2024, cards: 175, langs: ["en","fr","de","it","ja","zh"], date: "2024-09-13" },
  { game: "Pokémon", name: "SV Aventures Ensemble", code: "JTG", year: 2025, cards: 190, langs: ["en","fr","de","it","ja","zh"], date: "2025-03-28" },
  { game: "One Piece", name: "OP-10 Royal Blood", code: "OP10", year: 2025, cards: 121, langs: ["en","fr","de","it","ja","zh"], date: "2025-02-28" },
  { game: "One Piece", name: "OP-11 (à venir)", code: "OP11", year: 2025, cards: 121, langs: ["en","fr","ja","zh"], date: "2025-06-27" },
  { game: "Lorcana", name: "Lorcana — Set 7", code: "LOR7", year: 2025, cards: 204, langs: ["en","fr","de","it"], date: "2025-05-30" },
  { game: "Topps", name: "Topps Chrome UCL 2025/26", code: "UCL26", year: 2025, cards: 0, langs: ["en","fr","de","it","es"], date: "2025-11-01" },
  // futur : ne sera ajouté qu'à partir de sa date
  { game: "Pokémon", name: "SV Mega Évolution (à venir)", code: "MEG", year: 2026, cards: 200, langs: ["en","fr","de","it","ja","zh"], date: "2026-09-26" },
];

function getAddedReleases() {
  try { return JSON.parse(localStorage.getItem("rysao_added_releases") || "[]"); }
  catch { return []; }
}

async function checkForUpdates() {
  const today = new Date(); // 2026-06-25 dans cet environnement
  let feed = RELEASE_CALENDAR;
  if (RELEASE_FEED_URL) {
    try { const r = await fetch(RELEASE_FEED_URL); if (r.ok) feed = await r.json(); } catch {}
  }
  const known = new Set(TCG_DATA.map((s) => s.code));
  const added = [];
  for (const rel of feed) {
    if (known.has(rel.code)) continue;
    if (new Date(rel.date) <= today) {
      TCG_DATA.push({ game: rel.game, name: rel.name, code: rel.code, year: rel.year, cards: rel.cards, langs: rel.langs });
      added.push(rel);
    }
  }
  if (added.length) {
    localStorage.setItem("rysao_added_releases", JSON.stringify([...getAddedReleases(), ...added.map(a=>a.code)]));
    localStorage.setItem("rysao_last_update", today.toISOString());
  } else if (!localStorage.getItem("rysao_last_update")) {
    localStorage.setItem("rysao_last_update", today.toISOString());
  }
  return added;
}

window.getCurrency = getCurrency;
window.setCurrency = setCurrency;
window.fmtMoney = fmtMoney;
window.estimateGrades = estimateGrades;
window.gradeVerdict = gradeVerdict;
window.centeringByHouses = centeringByHouses;
window.worstCenterPct = worstCenterPct;
window.getPrice = getPrice;
window.getGradedPrice = getGradedPrice;
window.checkForUpdates = checkForUpdates;
