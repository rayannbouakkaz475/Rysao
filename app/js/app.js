/* ===========================================================================
   RYSAO TCG — Application (routing, rendu des vues, état)
   =========================================================================== */

const State = {
  view: "scan",
  theme: localStorage.getItem("rysao_theme") || "pokemon",
  plan: localStorage.getItem("rysao_plan") || "free",
  lastScan: null,
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
    social: viewSocial, settings: viewSettings,
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
  ctr.appendChild(btn); root.appendChild(ctr);

  const res = el("div", "scan-results");
  res.innerHTML = `
    <div class="metric"><span class="m-label" data-i="scan_centering"></span><span class="m-val" id="mCenter">—</span></div>
    <div class="metric"><span class="m-label" data-i="scan_borders"></span><span class="m-val" id="mBorders">—</span></div>
    <div class="metric"><span class="m-label" data-i="scan_quality"></span><span class="m-val" id="mQuality">—</span></div>
    <div class="metric big"><span class="m-label" data-i="scan_grade"></span><span class="m-val" id="mGrade">—</span></div>
    <div class="metric"><span class="m-label" data-i="scan_price"></span><span class="m-val" id="mPrice">—</span></div>`;
  root.appendChild(res);

  const video = $("#cam"), canvas = $("#frame");
  let active = false, lastResultTime = 0;

  btn.onclick = async () => {
    if (active) { Scanner.stop(); active = false; btn.textContent = t("scan_start"); btn.classList.add("primary"); return; }
    btn.textContent = "…";
    const ok = await Scanner.start(video, canvas, onScan);
    if (ok === false) return;
    active = true; btn.textContent = t("scan_stop"); btn.classList.remove("primary");
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
    const p = await getPrice(q);
    out.innerHTML = "";
    const card = el("div", "price-card");
    card.innerHTML = `
      <div class="price-name">${esc(q)}</div>
      <div class="price-grid">
        <div><span class="pl">Cardmarket</span><span class="pv">${fmtMoney(p.cardmarket.avg)}</span></div>
        <div><span class="pl">eBay</span><span class="pv">${fmtMoney(p.ebay.avg)}</span></div>
        <div><span class="pl">${t("prices_avg")}</span><span class="pv strong">${fmtMoney(p.avg)}</span></div>
        <div><span class="pl">${t("prices_low")} → ${t("prices_high")}</span><span class="pv">${fmtMoney(p.low)} → ${fmtMoney(p.high)}</span></div>
        <div><span class="pl">${t("prices_trend")}</span><span class="pv ${p.trend>=0?"up":"down"}">${p.trend>=0?"▲":"▼"} ${Math.abs(p.trend)}%</span></div>
      </div>
      <button class="btn add">${t("prices_add_collection")}</button>
      <p class="estimate-flag">~ ${t("prices_note")}</p>`;
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
   VUE — RÉSEAU / RECHERCHES
   ========================================================================= */
function getWants() { return store.get("rysao_wants", []); }
function viewSocial(root) {
  root.appendChild(el("h2", "view-title", t("social_title")));
  root.appendChild(el("p", "view-sub", t("social_sub")));

  if (!isPremium()) {
    const lock = el("div", "lock-banner", `🔒 ${t("premium_locked")}`);
    lock.onclick = () => nav("settings");
    root.appendChild(lock);
  }

  const form = el("div", "want-form");
  form.innerHTML = `
    <input id="wCard" class="search" placeholder="${t("social_card")}">
    <input id="wMax" class="search" type="number" placeholder="${t("social_max")} (EUR)">
    <input id="wMsg" class="search" placeholder="${t("social_msg")}">
    <button class="btn primary" id="wPub">${t("social_publish")}</button>`;
  root.appendChild(form);

  $("#wPub").onclick = () => {
    if (!isPremium()) { toast(t("premium_locked")); return; }
    const card = $("#wCard").value.trim(); if (!card) return;
    const w = getWants();
    w.unshift({ id: Date.now(), card, max: $("#wMax").value, msg: $("#wMsg").value, user: store.get("rysao_user","Moi"), date: Date.now() });
    store.set("rysao_wants", w); render(); toast(t("added"));
  };

  const list = el("div", "want-list"); root.appendChild(list);
  const wants = getWants();
  if (!wants.length) { list.appendChild(el("p", "empty", t("social_empty"))); return; }
  wants.forEach((w) => {
    const c = el("div", "want-card");
    c.innerHTML = `
      <div class="wc-top"><span class="wc-badge">${t("social_wanted")}</span><span class="wc-date">${new Date(w.date).toLocaleDateString(CURRENT_LANG)}</span></div>
      <div class="wc-card">${esc(w.card)}</div>
      ${w.max ? `<div class="wc-max">${t("social_max")}: ${fmtMoney(+w.max)}</div>` : ""}
      ${w.msg ? `<div class="wc-msg">${esc(w.msg)}</div>` : ""}
      <button class="btn contact">${t("social_have")} · ${t("social_contact")}</button>`;
    c.querySelector(".contact").onclick = () => toast(t("social_contact") + " ✓ (démo)");
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
    p.innerHTML = `<div class="pc-name">${t(nameK)}</div><p class="pc-desc">${t(descK)}</p>
      <button class="btn ${k==="premium"?"primary":""}">${State.plan===k?t("plan_current"):(k==="premium"?t("plan_upgrade"):t("plan_free"))}</button>`;
    p.querySelector("button").onclick = () => { State.plan = k; localStorage.setItem("rysao_plan", k); render(); toast("✓"); };
    cards.appendChild(p);
  });
  planBlk.appendChild(cards); root.appendChild(planBlk);

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

  render();
  applyI18n();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}
document.addEventListener("DOMContentLoaded", init);
