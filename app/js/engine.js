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

async function getPrice(query) {
  // Point d'extension : si une clé API est configurée, appeler le vrai service ici.
  // if (PRICE_API_KEY) { return await fetchLivePrice(query); }
  const h = hashStr(query.toLowerCase().trim());
  const base = 2 + (h % 4000) / 10;            // 2 .. ~402 EUR
  const spread = 0.15 + ((h >> 5) % 40) / 100; // 15% .. 55%
  const cm = base * (1 + (((h >> 3) % 20) - 10) / 100);
  const ebay = base * (1 + (((h >> 7) % 24) - 12) / 100);
  const avg = (cm + ebay) / 2;
  const trend = (((h >> 9) % 41) - 20);        // -20% .. +20%
  return {
    query,
    estimate: true,
    cardmarket: { avg: +cm.toFixed(2) },
    ebay: { avg: +ebay.toFixed(2) },
    avg: +avg.toFixed(2),
    low: +(avg * (1 - spread)).toFixed(2),
    high: +(avg * (1 + spread)).toFixed(2),
    trend,
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
window.getPrice = getPrice;
window.checkForUpdates = checkForUpdates;
