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

  /* ====================== EXTENSIONS DE CATALOGUE ======================
     Complète le seed hors-ligne. Le catalogue COMPLET (toutes les séries
     depuis l'origine) est chargé en plus dynamiquement via providers.js. */

  /* ---- Pokémon : ères supplémentaires ---- */
  { game: "Pokémon", name: "Neo Discovery", code: "N2", year: 2001, cards: 75, langs: ["en","fr","de","ja"] },
  { game: "Pokémon", name: "Neo Revelation", code: "N3", year: 2001, cards: 66, langs: ["en","fr","de","ja"] },
  { game: "Pokémon", name: "Neo Destiny", code: "N4", year: 2002, cards: 113, langs: ["en","fr","de","ja"] },
  { game: "Pokémon", name: "EX Sandstorm", code: "SS", year: 2003, cards: 100, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "EX Dragon", code: "DR", year: 2003, cards: 97, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "EX Deoxys", code: "DX", year: 2005, cards: 107, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "EX Emerald", code: "EM", year: 2005, cards: 106, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "Platinum", code: "PL", year: 2009, cards: 127, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "Call of Legends", code: "COL", year: 2011, cards: 95, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "BW Plasma Storm", code: "PLS", year: 2013, cards: 135, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "XY Roaring Skies", code: "ROS", year: 2015, cards: 110, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "SM Team Up", code: "TEU", year: 2019, cards: 196, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "SM Cosmic Eclipse", code: "CEC", year: 2019, cards: 271, langs: ["en","fr","de","it","ja"] },
  { game: "Pokémon", name: "SWSH Évolution Fusion", code: "FST", year: 2021, cards: 284, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "SWSH Origine Perdue", code: "LOR", year: 2022, cards: 217, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "SV Paldea Evolved", code: "PAL", year: 2023, cards: 279, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "SV Obsidian Flames", code: "OBF", year: 2023, cards: 230, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "SV Paradox Rift", code: "PAR", year: 2023, cards: 266, langs: ["en","fr","de","it","ja","zh"] },
  { game: "Pokémon", name: "SV Étincelles Déferlantes", code: "SSP", year: 2024, cards: 252, langs: ["en","fr","de","it","ja","zh"] },

  /* ---- One Piece : decks de démarrage & boosters complémentaires ---- */
  { game: "One Piece", name: "ST-01 Straw Hat Crew", code: "ST01", year: 2022, cards: 17, langs: ["en","ja","zh"] },
  { game: "One Piece", name: "ST-02 Worst Generation", code: "ST02", year: 2022, cards: 17, langs: ["en","ja","zh"] },
  { game: "One Piece", name: "ST-03 The Seven Warlords", code: "ST03", year: 2022, cards: 17, langs: ["en","ja","zh"] },
  { game: "One Piece", name: "ST-04 Animal Kingdom Pirates", code: "ST04", year: 2022, cards: 17, langs: ["en","ja","zh"] },
  { game: "One Piece", name: "ST-10 The Three Captains", code: "ST10", year: 2023, cards: 17, langs: ["en","fr","ja","zh"] },
  { game: "One Piece", name: "ST-12 Zoro & Sanji", code: "ST12", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "ST-14 3D2Y", code: "ST14", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "EB-01 Memorial Collection", code: "EB01", year: 2024, cards: 188, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "EB-02 Anime 25th Collection", code: "EB02", year: 2025, cards: 188, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "PRB-01 Premium Booster", code: "PRB01", year: 2024, cards: 369, langs: ["en","fr","de","it","ja","zh"] },

  /* ---- Lorcana : produits scellés / coffrets ---- */
  { game: "Lorcana", name: "Coffret Illumineur (Gift Set)", code: "GIFT", year: 2024, cards: 0, langs: ["en","fr","de","it"], sealed: true },
  { game: "Lorcana", name: "Display scellé Le Retour d'Ursula", code: "SEALED-URR", year: 2024, cards: 0, langs: ["en","fr","de","it"], sealed: true },

  /* ---- Topps : lignes supplémentaires ---- */
  { game: "Topps", name: "Bowman Chrome Baseball", code: "BOW", year: 1997, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Topps Finest Baseball", code: "FIN", year: 1993, cards: 199, langs: ["en"] },
  { game: "Topps", name: "Topps Stadium Club", code: "STC", year: 1991, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Topps UFC Chrome", code: "UFC", year: 2024, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Topps Star Wars", code: "SW", year: 1977, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Topps Premier League Merlin", code: "PLM", year: 2024, cards: 0, langs: ["en"] },

  /* ====================== COMPLÉMENT : ONE PIECE (decks de démarrage) ====== */
  { game: "One Piece", name: "ST-05 ONE PIECE FILM Edition", code: "ST05", year: 2023, cards: 17, langs: ["en","ja","zh"] },
  { game: "One Piece", name: "ST-06 Absolute Justice", code: "ST06", year: 2023, cards: 17, langs: ["en","fr","ja","zh"] },
  { game: "One Piece", name: "ST-07 Big Mom Pirates", code: "ST07", year: 2023, cards: 17, langs: ["en","fr","ja","zh"] },
  { game: "One Piece", name: "ST-08 Monkey.D.Luffy", code: "ST08", year: 2023, cards: 17, langs: ["en","fr","ja","zh"] },
  { game: "One Piece", name: "ST-09 Yamato", code: "ST09", year: 2023, cards: 17, langs: ["en","fr","ja","zh"] },
  { game: "One Piece", name: "ST-11 Uta", code: "ST11", year: 2023, cards: 17, langs: ["en","fr","ja","zh"] },
  { game: "One Piece", name: "ST-13 The Three Brothers", code: "ST13", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "ST-15 RED Edward.Newgate", code: "ST15", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "ST-16 GREEN Uta", code: "ST16", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "ST-17 BLUE Donquixote Doflamingo", code: "ST17", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "ST-18 PURPLE Monkey.D.Luffy", code: "ST18", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "ST-19 BLACK Smoker", code: "ST19", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "ST-20 YELLOW Charlotte Katakuri", code: "ST20", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "ST-21 EX Gear 5", code: "ST21", year: 2024, cards: 17, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "OP-10 Royal Blood", code: "OP10", year: 2025, cards: 121, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "OP-11 A Fist of Divine Speed", code: "OP11", year: 2025, cards: 121, langs: ["en","fr","de","it","ja","zh"] },
  { game: "One Piece", name: "PRB-02 Premium Booster", code: "PRB02", year: 2025, cards: 0, langs: ["en","fr","de","it","ja","zh"] },

  /* ====================== COMPLÉMENT : TOPPS ============================== */
  { game: "Topps", name: "Topps Chrome Formula 1", code: "F1C", year: 2020, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Topps Merlin Premier League", code: "MPL", year: 2023, cards: 0, langs: ["en","fr","de","it","es"] },
  { game: "Topps", name: "Topps Bundesliga Match Attax", code: "BMA", year: 2023, cards: 0, langs: ["de","en"] },
  { game: "Topps", name: "Topps Living Set", code: "LIV", year: 2018, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Topps Pokémon (Series 1-3, vintage)", code: "TPK", year: 2000, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Topps Garbage Pail Kids", code: "GPK", year: 1985, cards: 0, langs: ["en"] },
  { game: "Topps", name: "Bowman Baseball (flagship)", code: "BWF", year: 1989, cards: 0, langs: ["en"] },

  /* ====================== SCELLÉS — TOUS LES JEUX ========================= */
  /* Pokémon */
  { game: "Pokémon", name: "Display / Booster Box scellé (36 boosters)", code: "SEAL-PK-BB", year: 2024, cards: 0, langs: ["en","fr","de","it","es","ja","zh"], sealed: true },
  { game: "Pokémon", name: "Coffret Dresseur d'Élite (ETB) scellé", code: "SEAL-PK-ETB", year: 2024, cards: 0, langs: ["en","fr","de","it","es","ja"], sealed: true },
  { game: "Pokémon", name: "Bundle 6 boosters scellé", code: "SEAL-PK-BUN", year: 2024, cards: 0, langs: ["en","fr","de","it","es"], sealed: true },
  { game: "Pokémon", name: "Tin / Pokébox scellé", code: "SEAL-PK-TIN", year: 2024, cards: 0, langs: ["en","fr","de","it","es","ja"], sealed: true },
  { game: "Pokémon", name: "Display japonais scellé (Box JP)", code: "SEAL-PK-JP", year: 2024, cards: 0, langs: ["ja"], sealed: true },
  { game: "Pokémon", name: "Display chinois scellé (简体中文)", code: "SEAL-PK-ZH", year: 2024, cards: 0, langs: ["zh"], sealed: true },
  /* One Piece */
  { game: "One Piece", name: "Booster Box scellé (24 boosters)", code: "SEAL-OP-BB", year: 2024, cards: 0, langs: ["en","fr","de","it","ja","zh"], sealed: true },
  { game: "One Piece", name: "Starter Deck scellé", code: "SEAL-OP-ST", year: 2024, cards: 0, langs: ["en","fr","de","it","ja","zh"], sealed: true },
  { game: "One Piece", name: "Premium Booster scellé", code: "SEAL-OP-PRB", year: 2024, cards: 0, langs: ["en","fr","de","it","ja","zh"], sealed: true },
  /* Lorcana */
  { game: "Lorcana", name: "Booster Box scellé (24 boosters)", code: "SEAL-LOR-BB", year: 2024, cards: 0, langs: ["en","fr","de","it"], sealed: true },
  { game: "Lorcana", name: "Coffre de l'Illumineur (Illumineer's Trove) scellé", code: "SEAL-LOR-TROVE", year: 2024, cards: 0, langs: ["en","fr","de","it"], sealed: true },
  { game: "Lorcana", name: "Starter Deck scellé", code: "SEAL-LOR-ST", year: 2024, cards: 0, langs: ["en","fr","de","it"], sealed: true },
  { game: "Lorcana", name: "Gift Set / Coffret cadeau scellé", code: "SEAL-LOR-GIFT", year: 2024, cards: 0, langs: ["en","fr","de","it"], sealed: true },
  /* Topps */
  { game: "Topps", name: "Hobby Box scellé", code: "SEAL-TP-HOBBY", year: 2024, cards: 0, langs: ["en"], sealed: true },
  { game: "Topps", name: "Blaster Box scellé", code: "SEAL-TP-BLASTER", year: 2024, cards: 0, langs: ["en"], sealed: true },
  { game: "Topps", name: "Mega Box scellé", code: "SEAL-TP-MEGA", year: 2024, cards: 0, langs: ["en"], sealed: true },
  { game: "Topps", name: "Match Attax Tin scellé", code: "SEAL-TP-TIN", year: 2024, cards: 0, langs: ["en","fr","de","it","es"], sealed: true },
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
/* ---------------- STANDARDS DE CENTRAGE PAR MAISON ----------------
   Tolérance de centrage FACE par note : [note, % du plus grand côté].
   Ex. [10, 55] => une carte jusqu'à 55/45 peut viser la note 10 (centrage).
   Le centrage est NÉCESSAIRE mais pas suffisant (coins/bords/surface comptent).
   Valeurs publiées (PSA/BGS/CGC/SGC) ; approximations marquées pour les autres.
*/
const CENTERING_STANDARDS = {
  PSA:      [[10,55],[9,60],[8,65],[7,70],[6,75],[5,80]],
  BGS:      [[10,50],[9.5,55],[9,60],[8.5,65],[8,70],[7,75]],
  CGC:      [[10,50],[9.5,55],[9,60],[8,65],[7,70]],
  SGC:      [[10,55],[9,60],[8,65],[7,70]],
  TAG:      [[10,54],[9,60],[8,66],[7,72]],
  _default: [[10,55],[9,60],[8,65],[7,70],[6,75]],   // PCA, AFG, MGC, Gradia, ARS, GMA…
};
// Associe un nom de société (GRADING_COMPANIES) à un barème de centrage.
function centeringStandardFor(companyName) {
  const n = (companyName || "").toUpperCase();
  if (n.includes("PSA")) return CENTERING_STANDARDS.PSA;
  if (n.includes("BGS") || n.includes("BECKETT")) return CENTERING_STANDARDS.BGS;
  if (n.includes("CGC")) return CENTERING_STANDARDS.CGC;
  if (n.includes("SGC")) return CENTERING_STANDARDS.SGC;
  if (n.includes("TAG")) return CENTERING_STANDARDS.TAG;
  return CENTERING_STANDARDS._default;
}

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
window.CENTERING_STANDARDS = CENTERING_STANDARDS;
window.centeringStandardFor = centeringStandardFor;
window.CURRENCIES = CURRENCIES;
