/* ===========================================================================
   RYSAO TCG — Fournisseurs externes (vraies API, exécutées côté navigateur)
   - Prix RÉELS Cardmarket via pokemontcg.io (Pokémon), repli sur estimation
   - Catalogue COMPLET chargé dynamiquement (toutes les séries depuis l'origine)
       • Pokémon : https://api.pokemontcg.io/v2/sets
       • Lorcana : https://api.lorcast.com/v0/sets
   - Reconnaissance de carte par OCR (Tesseract.js, chargé à la demande)
   Tout est défensif : timeouts, try/catch, repli local, cache localStorage.
   =========================================================================== */

const Providers = (() => {
  const POKE_API = "https://api.pokemontcg.io/v2";
  const LORCAST_API = "https://api.lorcast.com/v0";
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

  // Fusionne dans TCG_DATA sans doublon (clé : game+code, sinon game+name)
  function mergeCatalog(items) {
    const key = (s) => (s.game + "|" + (s.code || s.name)).toLowerCase();
    const seen = new Set(TCG_DATA.map(key));
    let added = 0;
    for (const it of items) {
      if (!it.name) continue;
      if (seen.has(key(it))) continue;
      seen.add(key(it));
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
    const results = await Promise.allSettled([loadPokemonSets(), loadLorcanaSets()]);
    let items = [];
    for (const r of results) if (r.status === "fulfilled") items = items.concat(r.value);
    if (!items.length) throw new Error("no_catalog");
    localStorage.setItem("rysao_catalog_cache", JSON.stringify({ ts: Date.now(), items }));
    return { added: mergeCatalog(items), cached: false, total: items.length };
  }

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
        if (cm && (cm.averageSellPrice || cm.trendPrice)) {
          const avg = cm.averageSellPrice || cm.trendPrice;
          return {
            query, estimate: false, source: "pokemontcg.io · Cardmarket",
            image: best.images && best.images.small,
            matched: `${best.name} — ${best.set.name}`,
            cardmarket: { avg: +(+avg).toFixed(2) },
            ebay: { avg: +((cm.trendPrice || avg) * 1.05).toFixed(2) },
            avg: +(+avg).toFixed(2),
            low: +((cm.lowPrice || avg * 0.7)).toFixed(2),
            high: +((cm.suggestedPrice || cm.avg30 || avg * 1.4)).toFixed(2),
            trend: cm.avg7 && cm.avg30 ? Math.round(((cm.avg7 - cm.avg30) / cm.avg30) * 100) : 0,
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

  // Reconnaît le nom imprimé sur un canvas (zone du titre) et le mappe au catalogue.
  // Renvoie { text, set, card } ou { error }.
  async function recognize(sourceCanvas) {
    let T;
    try { T = await withTimeout(loadTesseract(), 15000); }
    catch { return { error: "ocr_unavailable" }; }

    // On extrait la bande supérieure (≈ où figure le nom) pour fiabiliser l'OCR
    const w = sourceCanvas.width, h = sourceCanvas.height;
    const crop = document.createElement("canvas");
    crop.width = Math.floor(w * 0.7); crop.height = Math.floor(h * 0.14);
    const cx = crop.getContext("2d");
    cx.drawImage(sourceCanvas, Math.floor(w * 0.13), Math.floor(h * 0.08), crop.width, crop.height, 0, 0, crop.width, crop.height);
    // contraste simple
    const img = cx.getImageData(0, 0, crop.width, crop.height);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const v = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const b = v > 130 ? 255 : 0;
      px[i] = px[i + 1] = px[i + 2] = b;
    }
    cx.putImageData(img, 0, 0);

    let text = "";
    try {
      const { data } = await withTimeout(T.recognize(crop), 20000);
      text = (data.text || "").replace(/\s+/g, " ").trim();
    } catch { return { error: "ocr_failed" }; }

    if (!text) return { error: "no_text" };

    // mappe au catalogue : meilleur set dont le nom partage des mots
    const words = text.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((x) => x.length > 2);
    let best = null, bestScore = 0;
    for (const s of TCG_DATA) {
      const name = (s.name + " " + s.game).toLowerCase();
      let score = 0;
      for (const wd of words) if (name.includes(wd)) score++;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return { text, set: bestScore > 0 ? best : null, card: text };
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

  return { loadFullCatalog, getLivePrice, recognize, loadTesseract, loadLeaflet, geocode };
})();

window.Providers = Providers;
