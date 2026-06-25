/* ===========================================================================
   RYSAO TCG — Données de référence
   - TCG_DATA : séries / sets / scellés (Pokémon, One Piece, Lorcana, Topps)
   - GRADING_COMPANIES : sociétés de gradation mondiales & européennes
   - CURRENCIES : devises supportées
   - Langues produit : fr, en, de, it, ja, zh (+ autres)
   NOTE : seed représentatif. Le système d'update (releases.js) ajoute
   automatiquement les nouvelles sorties au catalogue.
   =========================================================================== */

const PRODUCT_LANGS = [
  { code: "en", label: "English 🇬🇧" },
  { code: "fr", label: "Français 🇫🇷" },
  { code: "de", label: "Deutsch 🇩🇪" },
  { code: "it", label: "Italiano 🇮🇹" },
  { code: "es", label: "Español 🇪🇸" },
  { code: "ja", label: "日本語 🇯🇵" },
  { code: "ko", label: "한국어 🇰🇷" },
  { code: "zh", label: "中文 🇨🇳" },
];

/* Chaque entrée : { game, name, code, year, cards, langs, sealed?:true } */
const TCG_DATA = [
  /* ---------------- POKÉMON (échantillon historique large) ------------- */
  { game: "Pokémon", name: "Base Set", code: "BS", year: 1999, cards: 102, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "Jungle", code: "JU", year: 1999, cards: 64, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "Fossil", code: "FO", year: 1999, cards: 62, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "Team Rocket", code: "TR", year: 2000, cards: 83, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "Neo Genesis", code: "NG", year: 2000, cards: 111, langs: ["en","fr","de","ja"] },
  { game: "Pokémon", name: "Gym Heroes", code: "GH", year: 2000, cards: 132, langs: ["en","fr","de","ja"] },
  { game: "Pokémon", name: "EX Ruby & Sapphire", code: "RS", year: 2003, cards: 109, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "EX FireRed & LeafGreen", code: "FRLG", year: 2004, cards: 116, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "Diamond & Pearl", code: "DP", year: 2007, cards: 130, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "HeartGold & SoulSilver", code: "HGSS", year: 2010, cards: 124, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "Black & White", code: "BW", year: 2011, cards: 114, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "XY", code: "XY", year: 2014, cards: 146, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "XY Evolutions", code: "EVO", year: 2016, cards: 113, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "Sun & Moon", code: "SM", year: 2017, cards: 149, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "SM Hidden Fates", code: "HIF", year: 2019, cards: 163, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "Sword & Shield", code: "SSH", year: 2020, cards: 216, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "SWSH Évolution Céleste", code: "EVS", year: 2021, cards: 237, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "SWSH Brilliant Stars", code: "BRS", year: 2022, cards: 186, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "SWSH 151", code: "MEW", year: 2023, cards: 207, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "Écarlate & Violet", code: "SVI", year: 2023, cards: 258, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "SV Évolutions Prismatiques", code: "PRE", year: 2025, cards: 180, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "ETB / Display scellé Écarlate & Violet", code: "SEALED-SV", year: 2023, cards: 0, langs: ["en","fr","de","it","ja","zh"], sealed: true },
  { game: "Pokémon", name: "Coffret Dresseur d'élite 151 (scellé)", code: "SEALED-MEW", year: 2023, cards: 0, langs: ["en","fr","de","it","ja"], sealed: true },

  /* ---------------- ONE PIECE CARD GAME -------------------------------- */
  { game: "One Piece", name: "OP-01 Romance Dawn", code: "OP01", year: 2022, cards: 121, langs: ["en","ja","zh"] },
  { game: "One Piece", name: "OP-02 Paramount War", code: "OP02", year: 2023, cards: 121, langs: ["en","fr","ja","zh"] },
  { game: "One Piece", name: "OP-03 Pillars of Strength", code: "OP03", year: 2023, cards: 122, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "OP-04 Kingdoms of Intrigue", code: "OP04", year: 2023, cards: 122, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "OP-05 Awakening of the New Era", code: "OP05", year: 2024, cards: 122, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "OP-06 Wings of the Captain", code: "OP06", year: 2024, cards: 121, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "OP-07 500 Years in the Future", code: "OP07", year: 2024, cards: 121, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "OP-08 Two Legends", code: "OP08", year: 2024, cards: 122, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "OP-09 Emperors in the New World", code: "OP09", year: 2025, cards: 121, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "Booster Box scellé OP (Display)", code: "SEALED-OP", year: 2024, cards: 0, langs: ["en","fr","ja","zh"], sealed: true },

  /* ---------------- LORCANA ------------------------------------------- */
  { game: "Lorcana", name: "Premier Chapitre", code: "TFC", year: 2023, cards: 216, langs: ["en","fr","de","it"] },
  { game: "Lorcana", name: "L'Ascension des Floodborn", code: "ROF", year: 2023, cards: 204, langs: ["en","fr","de","it"] },
  { game: "Lorcana", name: "Les Terres d'Encre", code: "ITI", year: 2024, cards: 204, langs: ["en","fr","de","it"] },
  { game: "Lorcana", name: "Le Retour d'Ursula", code: "URR", year: 2024, cards: 204, langs: ["en","fr","de","it"] },
  { game: "Lorcana", name: "Ciel Scintillant", code: "SSK", year: 2024, cards: 204, langs: ["en","fr","de","it"] },
  { game: "Lorcana", name: "Azurite Sea", code: "AZS", year: 2025, cards: 204, langs: ["en","fr","de","it"] },
  { game: "Lorcana", name: "Coffret / Booster scellé Lorcana", code: "SEALED-LOR", year: 2024, cards: 0, langs: ["en","fr","de","it"], sealed: true },

  /* ---------------- TOPPS -------------------------------------------- */
  { game: "Topps", name: "Topps Chrome Baseball", code: "TC-BB", year: 1996, cards: 165, langs: ["en"] },
  { game: "Topps", name: "Topps Series 1 Baseball", code: "TS1", year: 1952, cards: 407, langs: ["en"] },
  { game: "Topps", name: "Topps Match Attax (Football)", code: "TMA", year: 2007, cards: 0, langs: ["en","fr","de","it","es"] },
  { game: "Topps", name: "Topps UEFA Champions League", code: "UCL", year: 2024, cards: 0, langs: ["en","fr","de","it","es"] },
  { game: "Topps", name: "Topps Chrome F1", code: "F1", year: 2020, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Topps Now", code: "NOW", year: 2016, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Hobby Box Topps Chrome (scellé)", code: "SEALED-TOPPS", year: 2024, cards: 0, langs: ["en"], sealed: true },
];

const TCG_GAMES = ["Pokémon", "One Piece", "Lorcana", "Topps"];

/* ---------------- SOCIÉTÉS DE GRADATION -----------------------------------
   highBase = facteur de base utilisé par l'estimateur de probabilité.
   Plus la société est stricte, plus highBase est bas (note haute plus dure).
*/
const GRADING_COMPANIES = [
  { name: "PSA", country: "USA", region: "world", scale: "1–10 (+ Gem Mint 10)", delay: "20–65 j", strict: 0.78, note: "Référence mondiale, forte liquidité." },
  { name: "Beckett (BGS)", country: "USA", region: "world", scale: "1–10 (Black Label 10)", delay: "20–60 j", strict: 0.68, note: "Sous-notes + Black Label très rare." },
  { name: "CGC Cards", country: "USA", region: "world", scale: "1–10 (Pristine 10)", delay: "15–45 j", strict: 0.80, note: "Montée en puissance, bon rapport prix." },
  { name: "SGC", country: "USA", region: "world", scale: "1–10", delay: "15–30 j", strict: 0.74, note: "Très apprécié pour le vintage/Topps." },
  { name: "TAG Grading", country: "USA", region: "world", scale: "1–10 (sub-grades IA)", delay: "15–40 j", strict: 0.79, note: "Notation assistée par IA, rapport détaillé." },
  { name: "ARS Grading", country: "USA", region: "world", scale: "1–10", delay: "20–40 j", strict: 0.77, note: "Slab épais, niche premium." },
  { name: "PCA (Pokémon Card Authority)", country: "France", region: "europe", scale: "1–10", delay: "10–30 j", strict: 0.82, note: "Acteur européen majeur, populaire en FR." },
  { name: "AFG (Authentic First Grading)", country: "France", region: "europe", scale: "1–10", delay: "10–25 j", strict: 0.81, note: "Européen, délais courts." },
  { name: "MGC (My Grading Company)", country: "Belgique", region: "europe", scale: "1–10", delay: "10–25 j", strict: 0.80, note: "Européen, croissance rapide." },
  { name: "Gradia", country: "Espagne", region: "europe", scale: "1–10", delay: "15–30 j", strict: 0.80, note: "Acteur ibérique." },
  { name: "GMA", country: "USA", region: "world", scale: "1–10", delay: "10–25 j", strict: 0.85, note: "Budget, délais courts." },
  { name: "Goldin / Other", country: "Intl.", region: "world", scale: "varié", delay: "—", strict: 0.78, note: "Maisons spécialisées." },
];

/* ---------------- DEVISES -------------------------------------------------
   rate = valeur de 1 EUR dans la devise (taux indicatif, modifiable).
*/
const CURRENCIES = [
  { code: "EUR", symbol: "€", rate: 1.00 },
  { code: "USD", symbol: "$", rate: 1.08 },
  { code: "GBP", symbol: "£", rate: 0.85 },
  { code: "CHF", symbol: "CHF", rate: 0.95 },
  { code: "JPY", symbol: "¥", rate: 170 },
  { code: "CNY", symbol: "¥", rate: 7.8 },
  { code: "CAD", symbol: "C$", rate: 1.47 },
];

window.PRODUCT_LANGS = PRODUCT_LANGS;
window.TCG_DATA = TCG_DATA;
window.TCG_GAMES = TCG_GAMES;
window.GRADING_COMPANIES = GRADING_COMPANIES;
window.CURRENCIES = CURRENCIES;
