/* ===========================================================================
   RYSAO TCG — Fournisseurs externes (vraies API, exécutées côté navigateur)
   - Prix RÉELS Cardmarket via pokemontcg.io (Pokémon), repli sur estimation
   - Catalogue COMPLET chargé dynamiquement (toutes les séries depuis l'origine)
       • Pokémon : https://api.tcgdex.net (multilingue fr/en/de/it/es/ja/ko/zh,
         + chinois zh-cn/zh-tw, sets japonais depuis 1996) ; repli pokemontcg.io
       • Lorcana : https://api.lorcast.com/v0/sets
       • One Piece : https://optcgapi.com/api/allSets/ (libre ; set_id/set_name) · Topps : seed
   - Reconnaissance de carte par OCR (Tesseract.js, chargé à la demande)
   Tout est défensif : timeouts, try/catch, repli local, cache localStorage.
   =========================================================================== */

const Providers = (() => {
  const POKE_API = "https://api.pokemontcg.io/v2";
  const LORCAST_API = "https://api.lorcast.com/v0";
  const TCGDEX_API = "https://api.tcgdex.net/v2";
  const OPTCG_API = "https://optcgapi.com/api"; // One Piece (libre, sans clé)
  // langues TCGdex -> tag interne RYSAO (zh-cn = simplifié/Chine, zh-tw = traditionnel)
  const TCGDEX_LANGS = [["en","en"],["fr","fr"],["de","de"],["it","it"],["es","es"],["pt","pt"],["ja","ja"],["ko","ko"],["zh-tw","zh"],["zh-cn","zh"],["id","id"],["th","th"]];
  const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  const CACHE_TTL = 7 * 24 * 3600 * 1000; // 7 jours

  // clé optionnelle pokemontcg.io (limite de débit plus haute)
  const pokeKey = () => localStorage.getItem("rysao_pokemontcg_key") || null;

  function withTimeout(promise, ms = 9000) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
  }

  async function getJSON(url, opts = {}) {
    const headers = opts.headers || {};
    const res = await withTimeout(fetch(url, { ...opts, headers }), opts.timeout || 9000);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  /* ---------------- CATALOGUE COMPLET ---------------- */
  function yearOf(dateStr) {
    const y = parseInt(String(dateStr || "").slice(0, 4), 10);
    return Number.isFinite(y) ? y : 0;
  }

  async function loadPokemonSets() {
    const headers = pokeKey() ? { "X-Api-Key": pokeKey() } : {};
    const d = await getJSON(`${POKE_API}/sets?orderBy=releaseDate&pageSize=400`, { headers });
    return (d.data || []).map((s) => ({
      game: "Pokémon",
      name: s.name,
      code: (s.ptcgoCode || s.id || s.name).toUpperCase(),
      year: yearOf(s.releaseDate),
      cards: s.total || s.printedTotal || 0,
      langs: ["en", "fr", "de", "it", "ja"],
      _src: "pokemontcg",
    }));
  }

  // Pokémon COMPLET & MULTILINGUE via TCGdex (inclut les sets japonais 1996+).
  // 1) GraphQL (en) pour id + date + nb de cartes ; 2) /{lang}/sets pour la
  // disponibilité par langue et les sets exclusifs (ex. JP).
  async function loadPokemonTCGdex() {
    const byId = new Map();
    try {
      const d = await getJSON(`${TCGDEX_API}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ sets { id name releaseDate cardCount { total } } }" }),
        timeout: 13000,
      });
      const sets = (d && d.data && d.data.sets) || [];
      for (const s of sets) byId.set(s.id, { id: s.id, name: s.name, year: yearOf(s.releaseDate), cards: (s.cardCount && s.cardCount.total) || 0, langs: new Set() });
    } catch (_) { /* on continue : la liste par langue suffit */ }

    for (const [api, tag] of TCGDEX_LANGS) {
      try {
        const list = await getJSON(`${TCGDEX_API}/${api}/sets`, { timeout: 12000 });
        for (const s of (list || [])) {
          let e = byId.get(s.id);
          if (!e) { e = { id: s.id, name: s.name, year: 0, cards: (s.cardCount && s.cardCount.total) || 0, langs: new Set() }; byId.set(s.id, e); }
          if (!e.name) e.name = s.name;
          e.langs.add(tag);
        }
      } catch (_) { /* langue indisponible : on ignore */ }
    }
    if (!byId.size) throw new Error("tcgdex_empty");
    return [...byId.values()].map((e) => ({
      game: "Pokémon", name: e.name, code: (e.id || e.name).toUpperCase(),
      year: e.year || 0, cards: e.cards,
      langs: e.langs.size ? [...e.langs] : ["en"], _src: "tcgdex",
    }));
  }

  // One Piece via optcgapi (libre, sans clé). Défensif : mappe des champs
  // courants et renvoie [] en cas d'échec (le seed statique prend le relais).
  async function loadOnePieceSets() {
    const d = await getJSON(`${OPTCG_API}/allSets/`, { timeout: 12000 });
    const arr = Array.isArray(d) ? d : (d.data || d.sets || []);
    return arr.map((s) => {
      const code = s.set_id || s.id || s.code || s.setCode || "";
      const name = s.set_name || s.name || code;
      return {
        game: "One Piece", name: code ? `${code} ${name}`.trim() : name,
        code: (code || name).toString().toUpperCase(),
        year: yearOf(s.release_date || s.releaseDate || s.date), cards: s.total || s.card_count || 0,
        langs: ["en", "fr", "de", "it", "ja", "zh"], _src: "optcg",
      };
    }).filter((s) => s.name);
  }

  async function loadLorcanaSets() {
    const d = await getJSON(`${LORCAST_API}/sets`);
    const arr = d.results || d.data || [];
    return arr.map((s) => ({
      game: "Lorcana",
      name: s.name,
      code: (s.code || s.id || s.name).toString().toUpperCase(),
      year: yearOf(s.released_at || s.releaseDate),
      cards: s.card_count || s.total || 0,
      langs: ["en", "fr", "de", "it"],
      _src: "lorcast",
    }));
  }

  // Fusionne dans TCG_DATA sans doublon (clé : game+code OU game+nom normalisé)
  const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  function mergeCatalog(items) {
    const codeKey = (s) => (s.game + "|" + (s.code || s.name)).toLowerCase();
    const nameKey = (s) => s.game + "|" + norm(s.name);
    const codes = new Set(TCG_DATA.map(codeKey));
    const names = new Set(TCG_DATA.map(nameKey));
    let added = 0;
    for (const it of items) {
      if (!it.name) continue;
      if (codes.has(codeKey(it)) || names.has(nameKey(it))) continue;
      codes.add(codeKey(it)); names.add(nameKey(it));
      TCG_DATA.push(it);
      added++;
    }
    return added;
  }

  // Charge le catalogue complet (cache 7 j). force=true ignore le cache.
  async function loadFullCatalog(force = false) {
    const cacheRaw = localStorage.getItem("rysao_catalog_cache");
    if (!force && cacheRaw) {
      try {
        const c = JSON.parse(cacheRaw);
        if (Date.now() - c.ts < CACHE_TTL && Array.isArray(c.items)) {
          return { added: mergeCatalog(c.items), cached: true, total: c.items.length };
        }
      } catch {}
    }
    // Pokémon : TCGdex (multilingue + JP 1996+), repli pokemontcg.io si échec.
    // Lorcana : lorcast. One Piece : optcgapi. (Topps : seed statique.)
    let items = [];
    const results = await Promise.allSettled([loadPokemonTCGdex(), loadLorcanaSets(), loadOnePieceSets()]);
    for (const r of results) if (r.status === "fulfilled") items = items.concat(r.value);
    if (!items.some((s) => s.game === "Pokémon")) {
      try { items = items.concat(await loadPokemonSets()); } catch {}
    }
    if (!items.length) throw new Error("no_catalog");
    localStorage.setItem("rysao_catalog_cache", JSON.stringify({ ts: Date.now(), items }));
    return { added: mergeCatalog(items), cached: false, total: items.length };
  }

  /* ---------------- LIENS MULTI-PLATEFORMES ---------------- */
  // Liens de recherche réels (ventes/annonces) pour comparer les prix.
  // opts = { graded, company, grade }
  function marketLinks(query, opts = {}) {
    const base = [query, opts.graded ? opts.company : "", opts.graded ? opts.grade : ""].filter(Boolean).join(" ");
    const q = encodeURIComponent(base);
    return {
      cardmarket: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(query)}`,
      ebay: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`,
      tcgplayer: `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(query)}`,
      pricecharting: `https://www.pricecharting.com/search-products?q=${q}&type=prices`,
      onepoint30: `https://130point.com/sales/?query=${q}`,
      psa: `https://www.psacard.com/auctionprices/search?q=${encodeURIComponent(query)}`,
    };
  }

  const usdToEur = (usd) => {
    const u = (window.CURRENCIES || []).find((c) => c.code === "USD");
    return u && u.rate ? usd / u.rate : usd * 0.92;
  };

  /* ---------------- PRIX RÉELS ---------------- */
  // Renvoie un objet prix au même format que engine.getPrice, ou null si indispo.
  async function getLivePrice(query, game) {
    // Pokémon : prix Cardmarket réels via pokemontcg.io
    if (!game || game === "Pokémon") {
      try {
        const headers = pokeKey() ? { "X-Api-Key": pokeKey() } : {};
        const q = encodeURIComponent(`name:"${query.split(/\s+/)[0]}*"`);
        const d = await getJSON(`${POKE_API}/cards?q=${q}&pageSize=8&orderBy=-set.releaseDate`, { headers });
        const cards = d.data || [];
        // meilleure correspondance par nom
        const ql = query.toLowerCase();
        const best = cards.find((c) => ql.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(ql.split(" ")[0])) || cards[0];
        const cm = best && best.cardmarket && best.cardmarket.prices;
        const tp = best && best.tcgplayer && best.tcgplayer.prices;
        if (cm && (cm.averageSellPrice || cm.trendPrice)) {
          const avg = cm.averageSellPrice || cm.trendPrice;
          // TCGplayer (USD) : on prend le 1er variant dispo (normal/holofoil…)
          let tcg = null;
          if (tp) { const v = Object.values(tp).find((x) => x && (x.market || x.mid)); if (v) tcg = usdToEur(v.market || v.mid); }
          const label = `${best.name} — ${best.set.name}`;
          return {
            query, estimate: false, source: "pokemontcg.io · Cardmarket + TCGplayer",
            image: best.images && best.images.small,
            matched: label,
            cardmarket: { avg: +(+avg).toFixed(2) },
            tcgplayer: tcg != null ? { avg: +tcg.toFixed(2) } : null,
            ebay: { avg: +((cm.trendPrice || avg) * 1.05).toFixed(2), estimate: true },
            avg: +(+avg).toFixed(2),
            low: +((cm.lowPrice || avg * 0.7)).toFixed(2),
            high: +((cm.suggestedPrice || cm.avg30 || avg * 1.4)).toFixed(2),
            trend: cm.avg7 && cm.avg30 ? Math.round(((cm.avg7 - cm.avg30) / cm.avg30) * 100) : 0,
            links: marketLinks(label),
          };
        }
      } catch (_) { /* repli */ }
    }
    return null; // -> l'appelant utilisera l'estimation
  }

  /* ---------------- OCR / RECONNAISSANCE ---------------- */
  let tesseractLoading = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractLoading) return tesseractLoading;
    tesseractLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = TESSERACT_CDN;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => reject(new Error("tesseract_load_failed"));
      document.head.appendChild(s);
    });
    return tesseractLoading;
  }

  // OCR d'une région relative (rx,ry,rw,rh ∈ 0..1) avec binarisation.
  async function ocrCrop(sourceCanvas, rx, ry, rw, rh, thresh = 130) {
    const T = await withTimeout(loadTesseract(), 15000);
    const w = sourceCanvas.width, h = sourceCanvas.height;
    const crop = document.createElement("canvas");
    crop.width = Math.max(8, Math.floor(w * rw)); crop.height = Math.max(8, Math.floor(h * rh));
    const cx = crop.getContext("2d");
    cx.drawImage(sourceCanvas, Math.floor(w * rx), Math.floor(h * ry), crop.width, crop.height, 0, 0, crop.width, crop.height);
    const img = cx.getImageData(0, 0, crop.width, crop.height);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const v = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const b = v > thresh ? 255 : 0;
      px[i] = px[i + 1] = px[i + 2] = b;
    }
    cx.putImageData(img, 0, 0);
    const { data } = await withTimeout(T.recognize(crop), 20000);
    return (data.text || "").replace(/\s+/g, " ").trim();
  }

  // Mappe un texte OCR au meilleur set du catalogue.
  function matchSet(text) {
    const words = (text || "").toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((x) => x.length > 2);
    let best = null, bestScore = 0;
    for (const s of TCG_DATA) {
      const name = (s.name + " " + s.game).toLowerCase();
      let score = 0;
      for (const wd of words) if (name.includes(wd)) score++;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return bestScore > 0 ? best : null;
  }

  // CARTE SIMPLE : lit le nom (bande haute) et le mappe au catalogue.
  async function recognize(sourceCanvas) {
    let text;
    try { text = await ocrCrop(sourceCanvas, 0.13, 0.08, 0.7, 0.14); }
    catch { return { error: "ocr_unavailable" }; }
    if (!text) return { error: "no_text" };
    return { text, set: matchSet(text), card: text };
  }

  // CARTE GRADÉE (slab) : lit le label (société + note + n° de certification)
  // puis le nom de la carte sous le label. Renvoie { graded, company, grade,
  // cert, card, set } ou { error }.
  async function recognizeGraded(sourceCanvas) {
    let label, name = "";
    try { label = await ocrCrop(sourceCanvas, 0.05, 0.02, 0.9, 0.15, 120); }
    catch { return { error: "ocr_unavailable" }; }
    try { name = await ocrCrop(sourceCanvas, 0.10, 0.17, 0.80, 0.16, 130); } catch {}
    const up = (label || "").toUpperCase();
    const company = (up.match(/PSA|BECKETT|BGS|CGC|SGC|PCA|AFG|MGC|GRADIA|GMA|TAG|ARS/) || [null])[0];
    const gm = up.match(/\b(10(?:\.0)?|[1-9](?:\.5)?)\b/);
    const grade = gm ? gm[1] : null;
    const cert = (up.match(/\b\d{7,9}\b/) || [null])[0];
    const card = name || label;
    return { graded: true, company, grade, cert, card, set: matchSet(card), labelText: label };
  }

  /* ---------------- RECONNAISSANCE VISUELLE (embeddings CLIP) ----------------
     Confirme l'OCR en comparant l'image scannée aux images officielles des
     cartes candidates (embeddings CLIP via transformers.js, chargé à la
     demande). Repli automatique sur l'OCR si le modèle/réseau est indispo. */
  const CLIP_CDN = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
  let clipLoading = null;
  async function loadCLIP() {
    if (window.__rysaoCLIP) return window.__rysaoCLIP;
    if (clipLoading) return clipLoading;
    clipLoading = (async () => {
      const mod = await import(/* @vite-ignore */ CLIP_CDN);
      const ext = await mod.pipeline("image-feature-extraction", "Xenova/clip-vit-base-patch32", { quantized: true });
      window.__rysaoCLIP = { mod, ext };
      return window.__rysaoCLIP;
    })();
    return clipLoading;
  }
  const cosine = (a, b) => {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return d / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  };
  async function embedURL({ ext, mod }, url) {
    const img = await mod.RawImage.fromURL(url);
    const out = await ext(img, { pooling: "mean", normalize: true });
    return out.data;
  }
  // Images candidates (avec visuel) pour la carte détectée — Pokémon via pokemontcg.io
  async function candidateImages(text, game) {
    if (game && game !== "Pokémon") return [];
    try {
      const headers = pokeKey() ? { "X-Api-Key": pokeKey() } : {};
      const q = encodeURIComponent(`name:"${(text || "").split(/\s+/)[0]}*"`);
      const d = await getJSON(`${POKE_API}/cards?q=${q}&pageSize=12`, { headers });
      return (d.data || []).filter((c) => c.images && c.images.small)
        .map((c) => ({ label: `${c.name} — ${c.set.name}`, img: c.images.small, set: matchSet(c.set.name) }));
    } catch { return []; }
  }
  // Reconnaissance carte simple AMÉLIORÉE : OCR + confirmation visuelle.
  async function recognizeVisual(sourceCanvas) {
    const base = await recognize(sourceCanvas);            // baseline OCR
    const text = base && base.card ? base.card : "";
    const game = base && base.set && base.set.game;
    const candidates = await candidateImages(text, game);
    if (!candidates.length) return base.error ? base : { ...base, method: "ocr" };
    try {
      const clip = await withTimeout(loadCLIP(), 30000);
      const photo = sourceCanvas.toDataURL("image/jpeg", 0.85);
      const pv = await embedURL(clip, photo);
      let best = null, bestSim = -1;
      for (const c of candidates) {
        try { const sim = cosine(pv, await embedURL(clip, c.img)); if (sim > bestSim) { bestSim = sim; best = c; } } catch {}
      }
      if (best && bestSim > 0.2) return { card: best.label, set: best.set, confidence: +bestSim.toFixed(2), method: "visual" };
    } catch (_) { /* repli OCR */ }
    return base.error ? base : { ...base, method: "ocr" };
  }

  /* ---------------- CARTE DU MONDE (Leaflet + géocodage) ---------------- */
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  let leafletLoading = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletLoading) return leafletLoading;
    leafletLoading = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet"; link.href = LEAFLET_CSS; link.dataset.leaflet = "1";
        document.head.appendChild(link);
      }
      const s = document.createElement("script");
      s.src = LEAFLET_JS;
      s.onload = () => resolve(window.L);
      s.onerror = () => reject(new Error("leaflet_load_failed"));
      document.head.appendChild(s);
    });
    return leafletLoading;
  }

  // Géocodage best-effort via Nominatim (OpenStreetMap). Renvoie {lat,lon} ou null.
  async function geocode(query) {
    if (!query) return null;
    try {
      const d = await getJSON(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": CURRENT_LANG }, timeout: 8000 });
      if (d && d[0]) return { lat: +d[0].lat, lon: +d[0].lon };
    } catch {}
    return null;
  }

  return { loadFullCatalog, getLivePrice, recognize, recognizeVisual, recognizeGraded, marketLinks, loadTesseract, loadLeaflet, geocode };
})();

window.Providers = Providers;
