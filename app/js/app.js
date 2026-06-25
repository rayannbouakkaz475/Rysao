/* ===========================================================================
   RYSAO TCG — Application (routing, rendu des vues, état)
   =========================================================================== */

const State = {
  view: "scan",
  theme: localStorage.getItem("rysao_theme") || "pokemon",
  plan: localStorage.getItem("rysao_plan") || "free",
  lastScan: null,
  comTab: "profile",
  chatPeer: null,
};

const THEMES = {
  pokemon:   { game: "Pokémon",   label: "Pokémon" },
  onepiece:  { game: "One Piece", label: "One Piece" },
  lorcana:   { game: "Lorcana",   label: "Lorcana" },
  topps:     { game: "Topps",     label: "Topps" },
};
const GAME_TO_THEME = { "Pokémon":"pokemon", "One Piece":"onepiece", "Lorcana":"lorcana", "Topps":"topps" };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const isPremium = () => State.plan === "premium";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c]));

/* ---------- stockage générique ---------- */
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

/* ---------- thème ---------- */
function setTheme(t) {
  if (!THEMES[t]) return;
  State.theme = t;
  localStorage.setItem("rysao_theme", t);
  document.body.dataset.theme = t;
  $$(".theme-chip").forEach((c) => c.classList.toggle("on", c.dataset.theme === t));
  if (["refs","prices"].includes(State.view)) render();
}

/* ---------- toast ---------- */
function toast(msg) {
  let tEl = $(".toast");
  if (!tEl) { tEl = el("div", "toast"); document.body.appendChild(tEl); }
  tEl.textContent = msg; tEl.classList.add("show");
  clearTimeout(tEl._t); tEl._t = setTimeout(() => tEl.classList.remove("show"), 1800);
}

/* =========================================================================
   ROUTING
   ========================================================================= */
function nav(view) { State.view = view; render(); window.scrollTo(0, 0); }

function render() {
  $$(".tab").forEach((b) => b.classList.toggle("on", b.dataset.view === State.view));
  const root = $("#view");
  root.innerHTML = "";
  ({
    scan: viewScan, refs: viewRefs, prices: viewPrices,
    collection: viewCollection, grading: viewGrading,
    community: viewCommunity, settings: viewSettings,
  }[State.view] || viewScan)(root);
  applyI18n();
}

/* =========================================================================
   VUE — SCAN
   ========================================================================= */
function viewScan(root) {
  root.appendChild(el("h2", "view-title", t("scan_title")));
  root.appendChild(el("p", "view-sub", t("scan_hint")));

  const stage = el("div", "scan-stage");
  stage.innerHTML = `
    <video id="cam" playsinline muted></video>
    <canvas id="frame" hidden></canvas>
    <div class="scan-guide"><div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div></div>
    <div class="scan-state" id="scanState">—</div>`;
  root.appendChild(stage);

  const ctr = el("div", "scan-ctrl");
  const btn = el("button", "btn primary", t("scan_start"));
  const recBtn = el("button", "btn", "🔎 " + t("scan_recognize")); recBtn.disabled = true;
  ctr.appendChild(btn); ctr.appendChild(recBtn); root.appendChild(ctr);

  const res = el("div", "scan-results");
  res.innerHTML = `
    <div class="metric big"><span class="m-label" data-i="scan_detected"></span><span class="m-val" id="mDetect">—</span></div>
    <div class="metric"><span class="m-label" data-i="scan_centering"></span><span class="m-val" id="mCenter">—</span></div>
    <div class="metric"><span class="m-label" data-i="scan_borders"></span><span class="m-val" id="mBorders">—</span></div>
    <div class="metric"><span class="m-label" data-i="scan_quality"></span><span class="m-val" id="mQuality">—</span></div>
    <div class="metric big"><span class="m-label" data-i="scan_grade"></span><span class="m-val" id="mGrade">—</span></div>
    <div class="metric big"><span class="m-label" data-i="scan_price"></span><span class="m-val" id="mPrice">—</span></div>`;
  root.appendChild(res);

  const video = $("#cam"), canvas = $("#frame");
  let active = false, lastResultTime = 0;

  btn.onclick = async () => {
    if (active) { Scanner.stop(); active = false; recBtn.disabled = true; btn.textContent = t("scan_start"); btn.classList.add("primary"); return; }
    btn.textContent = "…";
    const ok = await Scanner.start(video, canvas, onScan);
    if (ok === false) return;
    active = true; recBtn.disabled = false; btn.textContent = t("scan_stop"); btn.classList.remove("primary");
  };

  // Reconnaissance par OCR (à la demande) -> série détectée + prix
  recBtn.onclick = async () => {
    if (!active) return;
    recBtn.disabled = true; recBtn.textContent = t("scan_recognizing");
    try {
      const r = await Providers.recognize(canvas);
      if (r.error) { $("#mDetect").textContent = t("scan_ocr_off"); toast(t("scan_ocr_off")); }
      else {
        const setName = r.set ? `${r.set.game} · ${r.set.name}` : "—";
        $("#mDetect").textContent = `${r.card || "?"}${r.set ? " — " + setName : ""}`;
        // prix de la carte détectée
        $("#mPrice").textContent = t("scan_searching");
        const p = await getPrice(r.card, r.set && r.set.game);
        $("#mPrice").innerHTML = `${fmtMoney(p.avg)} <span class="flag-${p.estimate?"est":"live"}">${p.estimate?t("price_estimate"):t("price_live")}</span>`;
        State.lastRecognized = { name: r.card, value: p.avg };
      }
    } catch { $("#mDetect").textContent = t("scan_ocr_off"); }
    recBtn.disabled = false; recBtn.textContent = "🔎 " + t("scan_recognize");
  };

  function onScan(r) {
    if (r.error === "no_cam") { $("#scanState").textContent = t("scan_no_cam"); return; }
    const now = performance.now();
    if (now - lastResultTime < 120) return; // throttle UI
    lastResultTime = now;

    if (!r.aligned) {
      $("#scanState").textContent = t("scan_align");
      $("#scanState").className = "scan-state warn";
      return;
    }
    State.lastScan = r;
    $("#scanState").textContent = "● live";
    $("#scanState").className = "scan-state live";
    $("#mCenter").textContent = `${r.ratioLR} · ${r.ratioTB}`;
    $("#mBorders").textContent = `${r.borders.t} / ${r.borders.b} / ${r.borders.l} / ${r.borders.r}`;
    $("#mQuality").textContent = `${Math.round(r.quality * 100)}%`;
    const v = gradeVerdict(r.centeringScore);
    const gEl = $("#mGrade");
    gEl.textContent = t(v.key);
    gEl.className = "m-val verdict " + v.cls;
  }
}

/* =========================================================================
   VUE — RÉFÉRENCES
   ========================================================================= */
function viewRefs(root) {
  root.appendChild(el("h2", "view-title", t("refs_title")));
  const lu = store.get("rysao_last_update", null);
  const sub = el("p", "view-sub", "");
  sub.innerHTML = `${t("refs_update_note")}` + (lu ? ` · ${t("refs_last_update")}: ${new Date(lu).toLocaleDateString(CURRENT_LANG)}` : "");
  root.appendChild(sub);

  // filtres
  const bar = el("div", "filter-bar");
  const search = el("input", "search"); search.placeholder = t("refs_search");
  bar.appendChild(search);

  const langSel = el("select", "select");
  langSel.appendChild(new Option(t("refs_all"), ""));
  PRODUCT_LANGS.forEach((l) => langSel.appendChild(new Option(l.label, l.code)));
  bar.appendChild(langSel);
  root.appendChild(bar);

  const chips = el("div", "chips");
  const games = [{ k: "", l: t("refs_all") }, ...TCG_GAMES.map((g) => ({ k: g, l: g })), { k: "__sealed", l: t("refs_sealed") }];
  let activeGame = THEMES[State.theme].game;
  games.forEach((g) => {
    const c = el("button", "chip" + (g.k === activeGame ? " on" : ""), g.l);
    c.onclick = () => { activeGame = g.k; $$(".chip", chips).forEach((x) => x.classList.remove("on")); c.classList.add("on"); update(); };
    chips.appendChild(c);
  });
  root.appendChild(chips);

  // bouton : charger toutes les séries depuis les API (catalogue complet)
  const loadBar = el("div", "filter-bar");
  const loadBtn = el("button", "btn", "🌐 " + t("refs_load_full"));
  const count = el("span", "set-count", "");
  loadBar.appendChild(loadBtn); loadBar.appendChild(count); root.appendChild(loadBar);
  loadBtn.onclick = async () => {
    loadBtn.disabled = true; loadBtn.textContent = t("refs_loading");
    try {
      const r = await Providers.loadFullCatalog(true);
      toast(`${t("refs_loaded")} (+${r.added})`);
    } catch { toast(t("refs_offline")); }
    loadBtn.disabled = false; loadBtn.textContent = "🌐 " + t("refs_load_full");
    update();
  };

  const list = el("div", "set-list"); root.appendChild(list);

  function update() {
    const q = search.value.toLowerCase().trim();
    const lang = langSel.value;
    let data = TCG_DATA.slice();
    if (activeGame === "__sealed") data = data.filter((s) => s.sealed);
    else if (activeGame) data = data.filter((s) => s.game === activeGame);
    if (lang) data = data.filter((s) => s.langs.includes(lang));
    if (q) data = data.filter((s) => (s.name + " " + s.code + " " + s.game).toLowerCase().includes(q));
    data.sort((a, b) => b.year - a.year);

    count.textContent = `${data.length} ${t("refs_sets")}`;
    list.innerHTML = "";
    if (!data.length) { list.appendChild(el("p", "empty", "—")); return; }
    data.forEach((s) => {
      const card = el("div", "set-card" + (s.sealed ? " sealed" : ""));
      const langStr = s.langs.map((c) => (PRODUCT_LANGS.find((p) => p.code === c) || { label: c }).label.split(" ")[1] || c).join(" ");
      card.innerHTML = `
        <div class="set-game">${esc(s.game)}${s.sealed ? ' · <span class="tag-sealed">'+t("refs_sealed")+'</span>' : ""}</div>
        <div class="set-name">${esc(s.name)}</div>
        <div class="set-meta">
          <span>${esc(s.code)}</span>
          <span>${t("refs_year")}: ${s.year}</span>
          ${s.cards ? `<span>${t("refs_count")}: ${s.cards}</span>` : ""}
        </div>
        <div class="set-langs">${esc(langStr)}</div>`;
      list.appendChild(card);
    });
  }
  search.oninput = update;
  langSel.onchange = update;
  update();
}

/* =========================================================================
   VUE — PRIX
   ========================================================================= */
function viewPrices(root) {
  root.appendChild(el("h2", "view-title", t("prices_title")));
  root.appendChild(el("p", "view-sub", t("prices_sub")));

  const note = el("div", "note"); note.textContent = t("prices_note"); root.appendChild(note);

  const bar = el("div", "filter-bar");
  const search = el("input", "search"); search.placeholder = t("prices_search");
  const go = el("button", "btn primary", "🔍");
  bar.appendChild(search); bar.appendChild(go); root.appendChild(bar);

  const out = el("div", "price-out"); root.appendChild(out);

  async function run() {
    const q = search.value.trim(); if (!q) return;
    out.innerHTML = `<p class="empty">${t("scan_searching")}</p>`;
    const p = await getPrice(q, THEMES[State.theme].game);
    out.innerHTML = "";
    const card = el("div", "price-card");
    const flag = p.estimate
      ? `<span class="flag-est">${t("price_estimate")}</span>`
      : `<span class="flag-live">${t("price_live")} · ${esc(p.source || "")}</span>`;
    card.innerHTML = `
      <div class="price-name">${esc(p.matched || q)} ${flag}</div>
      <div class="price-grid">
        <div><span class="pl">Cardmarket</span><span class="pv">${fmtMoney(p.cardmarket.avg)}</span></div>
        <div><span class="pl">eBay</span><span class="pv">${fmtMoney(p.ebay.avg)}</span></div>
        <div><span class="pl">${t("prices_avg")}</span><span class="pv strong">${fmtMoney(p.avg)}</span></div>
        <div><span class="pl">${t("prices_low")} → ${t("prices_high")}</span><span class="pv">${fmtMoney(p.low)} → ${fmtMoney(p.high)}</span></div>
        <div><span class="pl">${t("prices_trend")}</span><span class="pv ${p.trend>=0?"up":"down"}">${p.trend>=0?"▲":"▼"} ${Math.abs(p.trend)}%</span></div>
      </div>
      <button class="btn add">${t("prices_add_collection")}</button>
      <p class="estimate-flag">${p.estimate ? "~ " + t("prices_note") : t("price_live") + " · " + esc(p.source || "")}</p>`;
    out.appendChild(card);
    card.querySelector(".add").onclick = () => { addToCollection({ name: q, value: p.avg }); toast(t("added")); };
  }
  go.onclick = run;
  search.onkeydown = (e) => { if (e.key === "Enter") run(); };
}

/* =========================================================================
   VUE — COLLECTION
   ========================================================================= */
function getCollection() { return store.get("rysao_collection", []); }
function saveCollection(c) { store.set("rysao_collection", c); }
function addToCollection(item) {
  const c = getCollection();
  if (!isPremium() && c.length >= 50) { toast(t("premium_locked")); return; }
  const ex = c.find((x) => x.name === item.name);
  if (ex) ex.qty = (ex.qty || 1) + 1;
  else c.push({ name: item.name, value: item.value || 0, qty: 1, id: Date.now() });
  saveCollection(c);
}

function viewCollection(root) {
  root.appendChild(el("h2", "view-title", t("coll_title")));
  const c = getCollection();
  const total = c.reduce((s, x) => s + (x.value || 0) * (x.qty || 1), 0);

  const head = el("div", "coll-head");
  head.innerHTML = `<div><span class="ch-label">${t("coll_value")}</span><span class="ch-val">${fmtMoney(total)}</span></div>
                    <div><span class="ch-label">${t("coll_cards")}</span><span class="ch-val">${c.reduce((s,x)=>s+(x.qty||1),0)}</span></div>`;
  root.appendChild(head);

  if (isPremium()) {
    const exp = el("button", "btn", t("coll_export"));
    exp.onclick = () => {
      const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
      const a = el("a"); a.href = URL.createObjectURL(blob); a.download = "rysao-collection.json"; a.click();
    };
    root.appendChild(exp);
  }

  if (!c.length) { root.appendChild(el("p", "empty", t("coll_empty"))); return; }

  const list = el("div", "coll-list");
  c.forEach((x) => {
    const row = el("div", "coll-row");
    row.innerHTML = `
      <div class="cr-name">${esc(x.name)}</div>
      <div class="cr-meta">${t("coll_qty")}: ${x.qty||1} · ${fmtMoney((x.value||0)*(x.qty||1))}</div>
      <button class="cr-del" aria-label="remove">✕</button>`;
    row.querySelector(".cr-del").onclick = () => { saveCollection(getCollection().filter((y) => y.id !== x.id)); render(); };
    list.appendChild(row);
  });
  root.appendChild(list);
}

/* =========================================================================
   VUE — GRADATION
   ========================================================================= */
function viewGrading(root) {
  root.appendChild(el("h2", "view-title", t("grading_title")));
  root.appendChild(el("p", "view-sub", t("grading_sub")));

  // estimateur
  const est = el("div", "grade-est");
  const cs = State.lastScan ? Math.round(State.lastScan.centeringScore * 100) : 70;
  est.innerHTML = `
    <label class="est-label">${t("grading_estimate")} — ${t("scan_centering")}: <b id="csVal">${cs}%</b></label>
    <input type="range" id="csRange" min="0" max="100" value="${cs}">
    <p class="hint">${t("grading_estimate_hint")}</p>`;
  root.appendChild(est);

  const region = el("div", "chips");
  let reg = "all";
  [{k:"all",l:t("refs_all")},{k:"world",l:t("grading_world")},{k:"europe",l:t("grading_europe")}].forEach((o) => {
    const c = el("button", "chip" + (o.k==="all"?" on":""), o.l);
    c.onclick = () => { reg = o.k; $$(".chip",region).forEach(x=>x.classList.remove("on")); c.classList.add("on"); update(); };
    region.appendChild(c);
  });
  root.appendChild(region);

  const list = el("div", "grade-list"); root.appendChild(list);

  function update() {
    const score = (+$("#csRange").value) / 100;
    $("#csVal").textContent = Math.round(score * 100) + "%";
    let rows = estimateGrades(score, score);
    if (reg !== "all") rows = rows.filter((r) => r.region === reg);
    list.innerHTML = "";
    rows.forEach((r) => {
      const pcls = r.proba >= 70 ? "ok" : r.proba >= 45 ? "warn" : "bad";
      const card = el("div", "grade-card");
      card.innerHTML = `
        <div class="gc-top"><span class="gc-name">${esc(r.name)}</span><span class="gc-flag">${esc(r.country)}</span></div>
        <div class="gc-bar"><div class="gc-fill ${pcls}" style="width:${r.proba}%"></div></div>
        <div class="gc-row"><span>${t("grading_proba")}</span><b>${r.proba}%</b></div>
        <div class="gc-row"><span>${t("scan_grade")}</span><b>${r.predicted}/10</b></div>
        <div class="gc-row dim"><span>${t("grading_scale")}</span><span>${esc(r.scale)}</span></div>
        <div class="gc-row dim"><span>${t("grading_delay")}</span><span>${esc(r.delay)}</span></div>
        <p class="gc-note">${esc(r.note)}</p>`;
      list.appendChild(card);
    });
  }
  $("#csRange").oninput = update;
  update();
}

/* =========================================================================
   VUE — COMMUNAUTÉ (Profil · Chat · Boutiques)
   Pas d'achat sur l'app : les membres s'affichent, échangent et se contactent.
   ========================================================================= */
function getProfile() { return store.get("rysao_profile", { name: "", sell: [], want: [] }); }
function saveProfile(p) { store.set("rysao_profile", p); }
function getChats() { return store.get("rysao_chats", {}); }
function saveChats(c) { store.set("rysao_chats", c); }
function getShops() { return store.get("rysao_shops", []); }
function saveShops(s) { store.set("rysao_shops", s); }
function getEvents() { return store.get("rysao_events", []); }
function saveEvents(e) { store.set("rysao_events", e); }

function viewCommunity(root) {
  root.appendChild(el("h2", "view-title", t("com_title")));
  root.appendChild(el("p", "view-sub", t("com_sub")));

  // segments
  const seg = el("div", "segment");
  const tabs = [["profile","com_profile"],["feed","com_feed"],["chat","com_chat"],["shops","com_shops"]];
  tabs.forEach(([k, lbl]) => {
    const b = el("button", "seg-btn" + (State.comTab === k ? " on" : ""), t(lbl));
    b.onclick = () => { State.comTab = k; render(); };
    seg.appendChild(b);
  });
  root.appendChild(seg);

  const body = el("div", "com-body"); root.appendChild(body);
  ({ profile: comProfile, feed: comFeed, chat: comChat, shops: comShops }[State.comTab] || comProfile)(body);
}

/* ---- Profil : items à vendre / recherchés ---- */
function comProfile(root) {
  const p = getProfile();
  const idRow = el("div", "filter-bar");
  idRow.innerHTML = `<input id="pName" class="search" placeholder="${t("prof_name")}" value="${esc(p.name)}">
                     <button class="btn primary" id="pSave">${t("prof_save")}</button>`;
  root.appendChild(idRow);
  $("#pSave", root).onclick = () => { p.name = $("#pName", root).value.trim(); saveProfile(p); toast(t("added")); };

  root.appendChild(el("p", "note", t("prof_note")));

  const mkList = (kind, titleKey, addKey, emptyKey, badge) => {
    const sec = el("div", "prof-sec");
    sec.appendChild(el("h3", "prof-h", t(titleKey)));
    const form = el("div", "want-form");
    form.innerHTML = `
      <input class="search f-item" placeholder="${t("prof_item")}">
      <input class="search f-price" type="number" placeholder="${t("prof_price")} (EUR)">
      ${kind==="sell" ? `<input class="search f-cond" placeholder="${t("prof_cond")}">` : ""}
      <button class="btn f-add">${t(addKey)}</button>`;
    sec.appendChild(form);
    const list = el("div", "want-list");
    const render2 = () => {
      list.innerHTML = "";
      const arr = p[kind];
      if (!arr.length) { list.appendChild(el("p", "empty", t(emptyKey))); return; }
      arr.forEach((it) => {
        const c = el("div", "want-card");
        c.innerHTML = `
          <div class="wc-top"><span class="wc-badge ${kind}">${badge}</span></div>
          <div class="wc-card">${esc(it.name)}</div>
          ${it.price ? `<div class="wc-max">${fmtMoney(+it.price)}</div>` : ""}
          ${it.cond ? `<div class="wc-msg">${t("prof_cond")}: ${esc(it.cond)}</div>` : ""}
          <button class="btn contact del">${t("item_remove")}</button>`;
        c.querySelector(".del").onclick = () => { p[kind] = p[kind].filter((x) => x.id !== it.id); saveProfile(p); render2(); };
        list.appendChild(c);
      });
    };
    form.querySelector(".f-add").onclick = () => {
      const name = form.querySelector(".f-item").value.trim(); if (!name) return;
      p[kind].unshift({ id: Date.now(), name, price: form.querySelector(".f-price").value,
        cond: kind==="sell" ? form.querySelector(".f-cond").value.trim() : "" });
      saveProfile(p); form.querySelector(".f-item").value=""; form.querySelector(".f-price").value="";
      if (kind==="sell") form.querySelector(".f-cond").value=""; render2();
    };
    sec.appendChild(list); render2();
    return sec;
  };
  root.appendChild(mkList("sell", "prof_sell", "prof_add_sell", "prof_empty_sell", "💰"));
  root.appendChild(mkList("want", "prof_want", "prof_add_want", "prof_empty_want", "🔎"));
}

/* ---- Chat entre membres (démo locale) ---- */
function comChat(root) {
  root.appendChild(el("p", "note", t("chat_demo")));
  const chats = getChats();
  const peers = Object.keys(chats);

  const newRow = el("div", "filter-bar");
  newRow.innerHTML = `<input id="cTo" class="search" placeholder="${t("chat_to")}">
                      <button class="btn primary" id="cNew">${t("chat_new")}</button>`;
  root.appendChild(newRow);
  $("#cNew", root).onclick = () => {
    const peer = $("#cTo", root).value.trim(); if (!peer) return;
    if (!chats[peer]) { chats[peer] = []; saveChats(chats); }
    State.chatPeer = peer; render();
  };

  if (!peers.length && !State.chatPeer) { root.appendChild(el("p", "empty", t("chat_empty"))); return; }

  const wrap = el("div", "chat-wrap");
  const side = el("div", "chat-list");
  peers.forEach((peer) => {
    const it = el("button", "chat-peer" + (State.chatPeer === peer ? " on" : ""), esc(peer));
    it.onclick = () => { State.chatPeer = peer; render(); };
    side.appendChild(it);
  });
  wrap.appendChild(side);

  const thread = el("div", "chat-thread");
  if (!State.chatPeer) thread.appendChild(el("p", "empty", t("chat_none_sel")));
  else {
    const msgs = chats[State.chatPeer] || [];
    const log = el("div", "chat-log");
    msgs.forEach((m) => log.appendChild(el("div", "msg " + (m.from === "me" ? "me" : "them"), esc(m.text))));
    thread.appendChild(log);
    const bar = el("div", "chat-input");
    bar.innerHTML = `<input class="search cMsg" placeholder="${t("chat_placeholder")}"><button class="btn primary cSend">${t("chat_send")}</button>`;
    const send = () => {
      const inp = bar.querySelector(".cMsg"); const txt = inp.value.trim(); if (!txt) return;
      chats[State.chatPeer].push({ from: "me", text: txt, ts: Date.now() });
      // réponse auto de démonstration (remplacée par un vrai backend temps réel)
      chats[State.chatPeer].push({ from: State.chatPeer, text: "👍 (" + t("chat_demo").split(".")[0] + ")", ts: Date.now() + 1 });
      saveChats(chats); render();
    };
    bar.querySelector(".cSend").onclick = send;
    bar.querySelector(".cMsg").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    thread.appendChild(bar);
  }
  wrap.appendChild(thread);
  root.appendChild(wrap);
}

/* ---- Boutiques : adresse + feed d'événements ---- */
function comShops(root) {
  // inscription boutique
  const reg = el("details", "shop-reg");
  reg.innerHTML = `<summary class="btn">${t("shop_register")}</summary>
    <div class="want-form" style="margin-top:10px">
      <input class="search s-name" placeholder="${t("shop_name")}">
      <input class="search s-addr" placeholder="${t("shop_address")}">
      <input class="search s-city" placeholder="${t("shop_city")}">
      <button class="btn primary s-save">${t("shop_save")}</button>
    </div>`;
  root.appendChild(reg);
  reg.querySelector(".s-save").onclick = () => {
    const name = reg.querySelector(".s-name").value.trim(); if (!name) return;
    const shops = getShops();
    shops.unshift({ id: Date.now(), name, address: reg.querySelector(".s-addr").value.trim(), city: reg.querySelector(".s-city").value.trim() });
    saveShops(shops); render(); toast(t("added"));
  };

  // liste des boutiques
  const shops = getShops();
  const shopList = el("div", "set-list");
  if (!shops.length) shopList.appendChild(el("p", "empty", t("shop_empty")));
  shops.forEach((s) => {
    const c = el("div", "set-card");
    const q = encodeURIComponent(`${s.name} ${s.address} ${s.city}`);
    c.innerHTML = `
      <div class="set-name">🏬 ${esc(s.name)}</div>
      <div class="set-meta"><span>${esc([s.address, s.city].filter(Boolean).join(", ") || "—")}</span></div>
      ${ (s.address||s.city) ? `<a class="shop-map" href="https://www.openstreetmap.org/search?query=${q}" target="_blank" rel="noopener">📍 ${t("shop_map")}</a>` : "" }`;
    shopList.appendChild(c);
  });
  root.appendChild(shopList);

  // Les boutiques publient aussi leurs événements dans le Feed (onglet Feed).
  const hint = el("p", "note", t("shop_feed_hint"));
  root.appendChild(hint);
}

/* ---- Feed social : posts/enchères, photos, likes, commentaires, analyse IA ---- */
function getFeed() { return store.get("rysao_feed", []); }
function saveFeed(f) { store.set("rysao_feed", f); }
function myName() { const p = getProfile(); return (p.name && p.name.trim()) || t("feed_anon"); }

// Analyse IA d'une image (dataURL) -> reconnaissance carte/série + prix suggéré
async function analyzePhoto(dataURL, game) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataURL; });
    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth || 600; cv.height = img.naturalHeight || 840;
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const r = await Providers.recognize(cv);
    if (r.error || !r.card) return null;
    let price = null;
    try { const p = await getPrice(r.card, r.set && r.set.game); price = p && p.avg; } catch {}
    return { card: r.card, set: r.set ? `${r.set.game} · ${r.set.name}` : null, price };
  } catch { return null; }
}

function comFeed(root) {
  // Composer
  const compose = el("div", "feed-compose");
  compose.innerHTML = `
    <textarea class="search fc-text" rows="2" placeholder="${t("feed_placeholder")}"></textarea>
    <div class="fc-row">
      <label class="btn fc-photo-lbl">📷 ${t("feed_photo")}<input type="file" accept="image/*" class="fc-photo" hidden></label>
      <label class="fc-auction"><input type="checkbox" class="fc-isauc"> ${t("feed_auction")}</label>
    </div>
    <input class="search fc-bid" type="number" placeholder="${t("feed_start_bid")} (EUR)" style="display:none">
    <div class="fc-preview"></div>
    <div class="fc-ai"></div>
    <button class="btn primary fc-pub">${t("feed_publish")}</button>`;
  root.appendChild(compose);

  let photoData = null, aiResult = null;
  const isAuc = compose.querySelector(".fc-isauc");
  const bidInp = compose.querySelector(".fc-bid");
  isAuc.onchange = () => { bidInp.style.display = isAuc.checked ? "block" : "none"; };

  compose.querySelector(".fc-photo").onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = async () => {
      photoData = rd.result;
      compose.querySelector(".fc-preview").innerHTML = `<img src="${photoData}" class="fc-img">`;
      // Analyse IA automatique
      const ai = compose.querySelector(".fc-ai");
      ai.textContent = "🤖 " + t("feed_analyzing");
      aiResult = await analyzePhoto(photoData, THEMES[State.theme].game);
      ai.innerHTML = aiResult
        ? `🤖 ${t("feed_ai")}: <b>${esc(aiResult.card)}</b>${aiResult.set ? " — " + esc(aiResult.set) : ""}${aiResult.price ? " · ~" + fmtMoney(aiResult.price) : ""}`
        : "🤖 " + t("feed_ai_none");
    };
    rd.readAsDataURL(file);
  };

  compose.querySelector(".fc-pub").onclick = () => {
    const text = compose.querySelector(".fc-text").value.trim();
    if (!text && !photoData) return;
    const feed = getFeed();
    feed.unshift({
      id: Date.now(), author: myName(), text, photo: photoData,
      auction: isAuc.checked, ai: aiResult,
      bid: isAuc.checked ? { current: +bidInp.value || (aiResult && aiResult.price) || 0, by: null } : null,
      likes: 0, liked: false, comments: [], ts: Date.now(),
    });
    saveFeed(feed); render(); toast(t("added"));
  };

  // Liste des publications
  const list = el("div", "feed-list"); root.appendChild(list);
  const feed = getFeed();
  if (!feed.length) { list.appendChild(el("p", "empty", t("feed_empty"))); return; }

  feed.forEach((post) => {
    const c = el("div", "feed-card");
    const initial = (post.author || "?").charAt(0).toUpperCase();
    c.innerHTML = `
      <div class="feed-head">
        <span class="feed-ava">${esc(initial)}</span>
        <div><div class="feed-author">${esc(post.author)}</div>
        <div class="feed-time">${new Date(post.ts).toLocaleString(CURRENT_LANG)}</div></div>
        ${post.auction ? `<span class="feed-badge-auc">🔨 ${t("feed_auction")}</span>` : ""}
      </div>
      ${post.text ? `<div class="feed-text">${esc(post.text)}</div>` : ""}
      ${post.photo ? `<img src="${post.photo}" class="feed-photo">` : ""}
      ${post.ai ? `<div class="feed-ai-tag">🤖 ${esc(post.ai.card)}${post.ai.set ? " — " + esc(post.ai.set) : ""}${post.ai.price ? " · ~" + fmtMoney(post.ai.price) : ""}</div>` : ""}
      ${post.auction ? `<div class="feed-auc"><span>${t("feed_current_bid")}: <b>${fmtMoney(post.bid.current)}</b>${post.bid.by ? " · " + esc(post.bid.by) : ""}</span><button class="btn feed-bid">${t("feed_place_bid")}</button></div>` : ""}
      <div class="feed-actions">
        <button class="feed-act like ${post.liked ? "on" : ""}">❤ <span>${post.likes}</span></button>
        <button class="feed-act cmt">💬 <span>${post.comments.length}</span></button>
      </div>
      <div class="feed-comments"></div>
      <div class="feed-addc"><input class="search cc-in" placeholder="${t("feed_comment")}"><button class="btn cc-add">${t("feed_send")}</button></div>`;

    // like
    c.querySelector(".like").onclick = () => {
      const f = getFeed(); const pp = f.find((x) => x.id === post.id);
      pp.liked = !pp.liked; pp.likes += pp.liked ? 1 : -1; saveFeed(f); render();
    };
    // enchère
    const bidBtn = c.querySelector(".feed-bid");
    if (bidBtn) bidBtn.onclick = () => {
      const amt = prompt(t("feed_place_bid") + " (EUR)"); if (!amt) return;
      const f = getFeed(); const pp = f.find((x) => x.id === post.id);
      const v = +amt; if (v > (pp.bid.current || 0)) { pp.bid = { current: v, by: myName() }; saveFeed(f); render(); }
    };
    // commentaires
    const cwrap = c.querySelector(".feed-comments");
    post.comments.forEach((cm) => cwrap.appendChild(el("div", "feed-cm", `<b>${esc(cm.author)}</b> ${esc(cm.text)}`)));
    const addC = () => {
      const inp = c.querySelector(".cc-in"); const txt = inp.value.trim(); if (!txt) return;
      const f = getFeed(); const pp = f.find((x) => x.id === post.id);
      pp.comments.push({ author: myName(), text: txt, ts: Date.now() }); saveFeed(f); render();
    };
    c.querySelector(".cc-add").onclick = addC;
    c.querySelector(".cc-in").addEventListener("keydown", (e) => { if (e.key === "Enter") addC(); });

    list.appendChild(c);
  });
}

/* =========================================================================
   VUE — RÉGLAGES
   ========================================================================= */
function viewSettings(root) {
  root.appendChild(el("h2", "view-title", t("settings_title")));

  // langue
  const langBlk = el("div", "set-block");
  langBlk.appendChild(el("label", "set-lbl", t("settings_lang")));
  const langSel = el("select", "select");
  Object.keys(I18N).forEach((code) => {
    const o = new Option(`${I18N[code]._flag} ${I18N[code]._name}`, code);
    if (code === CURRENT_LANG) o.selected = true;
    langSel.appendChild(o);
  });
  langSel.onchange = () => { setLang(langSel.value); render(); };
  langBlk.appendChild(langSel); root.appendChild(langBlk);

  // devise
  const curBlk = el("div", "set-block");
  curBlk.appendChild(el("label", "set-lbl", t("settings_currency")));
  const curSel = el("select", "select");
  CURRENCIES.forEach((c) => { const o = new Option(`${c.code} (${c.symbol})`, c.code); if (c.code === getCurrency().code) o.selected = true; curSel.appendChild(o); });
  curSel.onchange = () => { setCurrency(curSel.value); toast("✓"); };
  curBlk.appendChild(curSel); root.appendChild(curBlk);

  // abonnement
  const planBlk = el("div", "set-block");
  planBlk.appendChild(el("label", "set-lbl", t("settings_plan")));
  const cards = el("div", "plan-cards");
  [["free","plan_free","plan_free_desc"],["premium","plan_premium","plan_premium_desc"]].forEach(([k,nameK,descK]) => {
    const p = el("div", "plan-card" + (State.plan===k?" current":"") + (k==="premium"?" premium":""));
    p.innerHTML = `<div class="pc-name">${t(nameK)}${k==="premium"?` <span class="pc-price">${t("plan_premium_price")}</span>`:""}</div><p class="pc-desc">${t(descK)}</p>
      <button class="btn ${k==="premium"?"primary":""}">${State.plan===k?t("plan_current"):(k==="premium"?t("plan_upgrade"):t("plan_free"))}</button>`;
    p.querySelector("button").onclick = () => { State.plan = k; localStorage.setItem("rysao_plan", k); render(); toast("✓"); };
    cards.appendChild(p);
  });
  planBlk.appendChild(cards); root.appendChild(planBlk);

  // clés API (optionnel)
  const apiBlk = el("div", "set-block");
  apiBlk.appendChild(el("label", "set-lbl", t("settings_api")));
  const pokeKey = el("input", "search"); pokeKey.placeholder = t("settings_poke_key");
  pokeKey.value = localStorage.getItem("rysao_pokemontcg_key") || "";
  pokeKey.onchange = () => { localStorage.setItem("rysao_pokemontcg_key", pokeKey.value.trim()); toast("✓"); };
  const priceKey = el("input", "search"); priceKey.placeholder = t("settings_price_key");
  priceKey.style.marginTop = "8px";
  priceKey.value = localStorage.getItem("rysao_price_api") || "";
  priceKey.onchange = () => { localStorage.setItem("rysao_price_api", priceKey.value.trim()); toast("✓"); };
  apiBlk.appendChild(pokeKey); apiBlk.appendChild(priceKey); root.appendChild(apiBlk);

  // pokecardex
  const pcx = el("a", "btn pcx", "🔗 " + t("pokecardex"));
  pcx.href = "https://www.pokecardex.com/"; pcx.target = "_blank"; pcx.rel = "noopener";
  root.appendChild(pcx);
}

/* =========================================================================
   I18N appliqué au shell
   ========================================================================= */
function applyI18n() {
  $$("[data-i]").forEach((e) => { e.textContent = t(e.dataset.i); });
  $$(".tab").forEach((b) => { const lbl = b.querySelector(".tab-l"); if (lbl) lbl.textContent = t(b.dataset.i18n); });
  $("#brandTag") && ($("#brandTag").textContent = t("tagline"));
}
window.applyI18n = applyI18n;

/* =========================================================================
   INIT
   ========================================================================= */
async function init() {
  document.body.dataset.theme = State.theme;
  document.documentElement.lang = CURRENT_LANG;

  // barre de thèmes TCG
  const tbar = $("#themeBar");
  Object.entries(THEMES).forEach(([k, v]) => {
    const c = el("button", "theme-chip" + (k === State.theme ? " on" : ""), v.label);
    c.dataset.theme = k; c.onclick = () => setTheme(k);
    tbar.appendChild(c);
  });

  // onglets
  $$(".tab").forEach((b) => { b.onclick = () => nav(b.dataset.view); });

  // mise à jour des sorties
  const added = await checkForUpdates();
  if (added.length) toast(`+${added.length} ${t("refs_sets")} ✓`);

  // catalogue complet : depuis le cache si présent, sinon en arrière-plan
  if (window.Providers) {
    Providers.loadFullCatalog(false)
      .then((r) => { if (r && State.view === "refs") render(); })
      .catch(() => {});
  }

  render();
  applyI18n();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}
document.addEventListener("DOMContentLoaded", init);
