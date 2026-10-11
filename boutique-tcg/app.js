(() => {
  const PRODUITS = window.PRODUITS;
  const JEUX = window.JEUX;
  const TYPES = window.TYPES;
  const PAR_PAGE = 12;
  const LIVRAISON_OFFERTE = 100;
  const CLE_PANIER = "rysao-cards-panier";

  const $ = (s) => document.querySelector(s);
  const chf = (n) => "CHF " + n.toFixed(2);
  const echapper = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const parId = (id) => PRODUITS.find((p) => p.id === id);
  const enRupture = (p) => p.stock === 0;

  // Onglets : un par jeu, plus un onglet transversal pour les précommandes.
  const ONGLETS = {
    ...Object.fromEntries(Object.entries(JEUX).map(([k, j]) => [k, {
      nom: j.nom, emoji: j.emoji, filtre: (p) => p.jeu === k,
      sousTitre: `Tous nos produits scellés ${j.nom} : displays, coffrets et plus.`
    }])),
    precommandes: {
      nom: "Précommandes", emoji: "⏳", filtre: (p) => p.precommande,
      sousTitre: "Réserve les prochaines sorties, expédiées dès leur arrivée."
    }
  };
  const dansOnglet = (p, onglet) => !ONGLETS[onglet] || ONGLETS[onglet].filtre(p);

  const etat = {
    jeu: "tous",
    page: 1,
    types: new Set(),
    min: null,
    max: null,
    dispo: false,
    precommande: false,
    tri: "defaut",
    recherche: ""
  };

  // ---------- URL (#pokemon/page/2) ----------
  function lireUrl() {
    const [jeu, , page] = location.hash.replace(/^#\/?/, "").split("/");
    etat.jeu = ONGLETS[jeu] ? jeu : "tous";
    etat.page = Math.max(1, parseInt(page, 10) || 1);
  }
  function ecrireUrl() {
    let h = etat.jeu === "tous" ? "" : etat.jeu;
    if (etat.page > 1) h = (h || "tous") + "/page/" + etat.page;
    const voulu = h ? "#" + h : "";
    if (voulu !== location.hash) history.pushState(null, "", voulu || location.pathname + location.search);
  }

  // ---------- Filtrage ----------
  function produitsFiltres() {
    const q = etat.recherche.trim().toLowerCase();
    let liste = PRODUITS.filter((p) =>
      dansOnglet(p, etat.jeu) &&
      (!etat.types.size || etat.types.has(p.type)) &&
      (etat.min == null || p.prix >= etat.min) &&
      (etat.max == null || p.prix <= etat.max) &&
      (!etat.dispo || !enRupture(p)) &&
      (!etat.precommande || p.precommande) &&
      (!q || (p.nom + " " + JEUX[p.jeu].nom + " " + TYPES[p.type]).toLowerCase().includes(q))
    );
    const tris = {
      "prix-asc": (a, b) => a.prix - b.prix,
      "prix-desc": (a, b) => b.prix - a.prix,
      "nom": (a, b) => a.nom.localeCompare(b.nom, "fr")
    };
    if (tris[etat.tri]) liste = [...liste].sort(tris[etat.tri]);
    return liste;
  }

  // ---------- Rendu ----------
  // Décors dessinés en SVG (aucune image externe).
  const ICONES = {
    eclair: `<svg viewBox="0 0 24 24" class="ico"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/></svg>`,
    crane: `<svg viewBox="0 0 100 100" class="ico" stroke="none">
      <g stroke="currentColor" stroke-width="9" stroke-linecap="round"><path d="M16 64 84 94M84 64 16 94"/></g>
      <path d="M50 8C29 8 17 22 17 40c0 10 5 18 12 22v12h42V62c7-4 12-12 12-22 0-18-12-32-33-32z" fill="currentColor"/>
      <circle cx="37" cy="42" r="8.5" fill="var(--trou, #13263a)"/><circle cx="63" cy="42" r="8.5" fill="var(--trou, #13263a)"/>
      <path d="M50 51 44 61h12z" fill="var(--trou, #13263a)"/>
      <path d="M38 74v-7M46 74v-7M54 74v-7M62 74v-7" stroke="var(--trou, #13263a)" stroke-width="3"/></svg>`,
    pyramide: `<svg viewBox="0 0 100 100" class="ico" fill="none" stroke="currentColor">
      <path d="M50 6 95 90H5z" stroke-width="5" stroke-linejoin="round"/>
      <path d="M27 62q23-24 46 0q-23 24-46 0z" stroke-width="4"/>
      <circle cx="50" cy="62" r="7" fill="currentColor" stroke="none"/>
      <path d="M50 75v12M38 72l-5 10M62 72l5 10" stroke-width="3"/></svg>`,
    sablier: `<svg viewBox="0 0 24 24" class="ico"><path d="M6 3h12M6 21h12M7 3c0 6 10 6 10 12v6M17 3c0 6-10 6-10 12v6"/></svg>`
  };

  const UNIVERS = {
    pokemon: {
      slogan: "Pars à l'aventure, un booster après l'autre.",
      texte: "Displays, Élite Trainer Box, coffrets et Pokebox en version française.",
      deco: `<span class="pk-ball deco-1"></span><span class="pk-ball deco-2"></span><span class="deco-eclair">${ICONES.eclair}</span>`
    },
    onepiece: {
      slogan: "Le trésor t'attend, moussaillon.",
      texte: "Hisse le pavillon : displays du One Piece Card Game.",
      deco: `<span class="deco-pavillon">${ICONES.crane}</span><span class="deco-vagues"></span>`
    },
    yugioh: {
      slogan: "Prépare ton deck, le duel commence.",
      texte: "Displays et blisters pour renforcer ton deck.",
      deco: `<span class="deco-pyramide">${ICONES.pyramide}</span><span class="deco-etoiles"></span>`
    },
    precommandes: {
      slogan: "Les prochaines sorties, réservées avant tout le monde.",
      texte: "Pokémon, One Piece et Yu-Gi-Oh réunis : réserve maintenant, on expédie dès l'arrivée du stock.",
      deco: `<span class="deco-sablier">${ICONES.sablier}</span>`
    }
  };

  function vignette(p) {
    if (p.image) return `<img src="${echapper(p.image)}" alt="${echapper(p.nom)}" loading="lazy">`;
    const code = p.nom.replace(/^(Display|Élite Trainer Box|Coffret|Pokebox|Tapis|Blister)\s*/i, "") || p.nom;
    const motif = {
      pokemon: p.type === "accessoire" ? `<span class="art-eclair">${ICONES.eclair}</span>` : `<span class="pk-ball art-ball"></span>`,
      onepiece: `<span class="art-crane">${ICONES.crane}</span>`,
      yugioh: `<span class="art-pyramide">${ICONES.pyramide}</span>`
    }[p.jeu];
    return `<div class="vignette v-${p.jeu}">
      ${motif}
      <span class="type">${TYPES[p.type]}</span>
      <span class="code">${echapper(code)}</span>
    </div>`;
  }

  function badges(p) {
    const b = [];
    if (p.precommande) b.push(`<span class="badge badge-pre">Précommande${p.sortie ? " · " + echapper(p.sortie) : ""}</span>`);
    if (enRupture(p)) b.push(`<span class="badge badge-rupture">Rupture</span>`);
    else if (p.stock != null && p.stock <= 3) b.push(`<span class="badge badge-faible">Plus que ${p.stock}</span>`);
    return b.length ? `<div class="badges">${b.join("")}</div>` : "";
  }

  function stock(p) {
    if (enRupture(p)) return `<span class="stock rupture">Rupture de stock</span>`;
    if (p.stock == null) return `<span class="stock">En stock</span>`;
    return `<span class="stock${p.stock <= 3 ? " faible" : ""}">${p.stock} en stock</span>`;
  }

  const drapeau = (p) => (p.langue === "fr" ? ` <span class="drapeau" title="Version française">🇫🇷</span>` : "");

  const visuel = (p) => `<button class="visuel" data-vue="${p.id}" aria-label="Vue rapide : ${echapper(p.nom)}">
      ${vignette(p)}${badges(p)}<span class="vue-rapide-btn">Vue rapide</span></button>`;
  const nom = (p) => `<button data-vue="${p.id}">${echapper(p.nom)}</button>`;
  const ajout = (p, texte = "") => `<button class="btn btn-plein btn-ajout${texte ? " avec-texte" : ""}" data-ajout="${p.id}"
      ${enRupture(p) ? "disabled" : ""} aria-label="Ajouter ${echapper(p.nom)} au panier">
      <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>${texte}</button>`;

  // Niveau façon Yu-Gi-Oh : plus le produit est gros, plus il a d'étoiles.
  const NIVEAUX = { display: 8, etb: 7, coffret: 5, pokebox: 4, accessoire: 3, blister: 2 };

  // Chaque jeu a son propre modèle de fiche produit.
  const MODELES = {
    pokemon: (p) => `<article class="produit u-pokemon"><div class="pk-cadre">
      <div class="pk-tete">
        <span class="pk-stade">${TYPES[p.type]}</span>
        <h3 class="produit-nom">${nom(p)}</h3>
        <span class="pk-pv"><small>CHF</small>${p.prix.toFixed(2)}<span class="pk-energie">${ICONES.eclair}</span></span>
      </div>
      ${visuel(p)}
      <div class="pk-bande">Pokémon · ${TYPES[p.type]}${drapeau(p)}</div>
      <p class="pk-desc">${echapper(p.description || "")}</p>
      <div class="produit-bas">${stock(p)}${ajout(p)}</div>
    </div></article>`,

    onepiece: (p) => `<article class="produit u-onepiece"><div class="op-affiche">
      <div class="op-wanted">WANTED</div>
      ${visuel(p)}
      <div class="op-dead">DEAD OR ALIVE</div>
      <h3 class="produit-nom">${nom(p)}${drapeau(p)}</h3>
      <div class="op-prime"><span class="op-berry">CHF</span>${p.prix.toFixed(2)}<span class="op-tiret">—</span></div>
      <div class="produit-bas">${stock(p)}${ajout(p)}</div>
      <span class="op-sceau">MARINE</span>
    </div></article>`,

    yugioh: (p) => `<article class="produit u-yugioh"><div class="yg-cadre yg-${p.type}">
      <div class="yg-nom"><h3 class="produit-nom">${nom(p)}</h3><span class="yg-attr">${ICONES.pyramide}</span></div>
      <div class="yg-niveau" aria-label="Niveau ${NIVEAUX[p.type]}">${"<i></i>".repeat(NIVEAUX[p.type])}</div>
      ${visuel(p)}
      <div class="yg-texte">
        <b>[ ${TYPES[p.type]} / Effet ]</b>${drapeau(p)}
        <p>${echapper(p.description || "")}</p>
        <div class="yg-stats"><span>ATK/<b>${p.prix.toFixed(2)}</b></span><span>${stock(p)}</span></div>
      </div>
      <div class="produit-bas">${ajout(p, "Ajouter au deck")}</div>
    </div></article>`
  };
  const carte = (p) => MODELES[p.jeu](p);

  function rendreNav() {
    const compte = (onglet) => PRODUITS.filter((p) => dansOnglet(p, onglet)).length;
    const items = [["tous", "Tous", "🛍️"], ...Object.entries(ONGLETS).map(([k, o]) => [k, o.nom, o.emoji])];
    $("#nav-jeux").innerHTML = items.map(([k, nom, emoji]) =>
      `<button data-jeu="${k}" class="onglet-${k}" aria-pressed="${etat.jeu === k}">${emoji} ${nom} <small>${compte(k)}</small></button>`
    ).join("");
    $("#pied-jeux").innerHTML = Object.entries(JEUX).map(([k, j]) =>
      `<li><a href="#${k}" data-jeu="${k}">${j.nom}</a></li>`).join("");
  }

  function rendreFiltresTypes() {
    const base = PRODUITS.filter((p) => dansOnglet(p, etat.jeu));
    const presents = Object.keys(TYPES).filter((t) => base.some((p) => p.type === t));
    for (const t of [...etat.types]) if (!presents.includes(t)) etat.types.delete(t);
    $("#f-types").innerHTML = presents.map((t) =>
      `<label class="case"><input type="checkbox" value="${t}" ${etat.types.has(t) ? "checked" : ""}> ${TYPES[t]}
       <small>${base.filter((p) => p.type === t).length}</small></label>`).join("");
  }

  function rendreEntete() {
    const j = ONGLETS[etat.jeu];
    const u = UNIVERS[etat.jeu];
    document.body.dataset.univers = etat.jeu;
    document.title = (j ? j.nom + " — " : "") + "Rysao Cards";
    $("#fil").innerHTML = `<a href="#" data-jeu="tous">Accueil</a><span>/</span>` +
      (j ? `<a href="#${etat.jeu}" data-jeu="${etat.jeu}">${j.nom}</a>` : `<span>Boutique</span>`) +
      (etat.page > 1 ? `<span>/</span><span>Page ${etat.page}</span>` : "");

    if (!j) {
      $("#hero").innerHTML = `
        <div class="accueil-tete">
          <h1>Choisis ton univers</h1>
          <p>Produits scellés et 100 % authentiques, expédiés depuis la Suisse.</p>
        </div>
        <div class="portails">${Object.entries(JEUX).map(([k, jeu]) => `
          <button class="portail portail-${k}" data-jeu="${k}">
            <span class="portail-deco">${UNIVERS[k].deco}</span>
            <span class="portail-txt">
              <strong>${jeu.nom}</strong>
              <em>${UNIVERS[k].slogan}</em>
              <span class="portail-cta">Entrer · ${PRODUITS.filter((p) => p.jeu === k).length} produits →</span>
            </span>
          </button>`).join("")}
        </div>`;
      return;
    }
    $("#hero").innerHTML = `
      <div class="banniere banniere-${etat.jeu}">
        <div class="banniere-deco" aria-hidden="true">${u.deco}</div>
        <div class="banniere-txt">
          <span class="surtitre">${j.emoji} ${etat.jeu === "precommandes" ? "Bientôt disponible" : "Univers"}</span>
          <h1>${j.nom}</h1>
          <p class="slogan">${u.slogan}</p>
          <p>${u.texte}</p>
        </div>
      </div>`;
  }

  function rendrePagination(nbPages) {
    if (nbPages <= 1) { $("#pagination").innerHTML = ""; return; }
    let h = `<button data-page="${etat.page - 1}" ${etat.page === 1 ? "disabled" : ""} aria-label="Page précédente">‹</button>`;
    for (let i = 1; i <= nbPages; i++) {
      h += `<button data-page="${i}" ${i === etat.page ? 'aria-current="page"' : ""}>${i}</button>`;
    }
    h += `<button data-page="${etat.page + 1}" ${etat.page === nbPages ? "disabled" : ""} aria-label="Page suivante">›</button>`;
    $("#pagination").innerHTML = h;
  }

  // Précommandes : page globale, regroupée par univers (tous les jeux, sans pagination).
  function rendrePrecommandes(liste) {
    return Object.entries(JEUX).map(([k, jeu]) => {
      const items = liste.filter((p) => p.jeu === k);
      return `<section class="groupe groupe-${k}">
        <header class="groupe-tete banniere-${k}">
          <span class="groupe-deco" aria-hidden="true">${UNIVERS[k].deco}</span>
          <h2>${jeu.nom}</h2>
          <span class="groupe-compte">${items.length ? `${items.length} précommande${items.length > 1 ? "s" : ""}` : "Bientôt"}</span>
          <button class="groupe-lien" data-jeu="${k}">Tout l'univers ${jeu.nom} →</button>
        </header>
        ${items.length
          ? `<div class="grille">${items.map(carte).join("")}</div>`
          : `<p class="groupe-vide">Aucune précommande ${jeu.nom} pour le moment. Les prochaines sorties apparaîtront ici dès leur annonce.</p>`}
      </section>`;
    }).join("");
  }

  function rendre() {
    const liste = produitsFiltres();
    const groupe = etat.jeu === "precommandes";
    if (groupe) etat.page = 1;
    const nbPages = groupe ? 1 : Math.max(1, Math.ceil(liste.length / PAR_PAGE));
    if (etat.page > nbPages) etat.page = nbPages;
    const debut = (etat.page - 1) * PAR_PAGE;
    const page = liste.slice(debut, debut + PAR_PAGE);

    rendreNav();
    rendreEntete();
    const grille = $("#grille");
    grille.classList.toggle("groupes", groupe);
    grille.innerHTML = groupe ? rendrePrecommandes(liste) : page.map(carte).join("");
    $("#vide").hidden = groupe || liste.length > 0;
    $("#compte").textContent = groupe
      ? `${liste.length} précommande${liste.length > 1 ? "s" : ""}, tous univers confondus`
      : liste.length
        ? `Affichage de ${debut + 1}–${debut + page.length} sur ${liste.length} produit${liste.length > 1 ? "s" : ""}`
        : "";
    $("#appliquer-filtres").textContent = `Voir les ${liste.length} résultat${liste.length > 1 ? "s" : ""}`;
    rendrePagination(nbPages);
    ecrireUrl();
  }

  function changerJeu(jeu) {
    etat.jeu = ONGLETS[jeu] ? jeu : "tous";
    etat.page = 1;
    rendreFiltresTypes();
    rendre();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Vue rapide ----------
  const dialogue = $("#vue-rapide");
  let qteVue = 1;
  function ouvrirVue(id) {
    const p = parId(id);
    if (!p) return;
    qteVue = 1;
    dialogue.dataset.univers = p.jeu;
    $("#vue-rapide-corps").innerHTML = `
      <div class="visuel">${vignette(p)}${badges(p)}</div>
      <div class="modale-infos">
        <span class="produit-jeu">${JEUX[p.jeu].nom} · ${TYPES[p.type]}</span>
        <h2>${echapper(p.nom)}${drapeau(p)}</h2>
        <span class="prix">${chf(p.prix)}</span>
        ${stock(p)}
        <p>${echapper(p.description || "")}</p>
        ${p.precommande ? `<p><strong>Précommande</strong>${p.sortie ? " — sortie prévue le " + echapper(p.sortie) : ""}. Expédié dès réception.</p>` : ""}
        <div class="quantite">
          <div class="qte"><button data-qv="-1" aria-label="Moins">−</button><span id="qv">1</span><button data-qv="1" aria-label="Plus">+</button></div>
          <button class="btn btn-plein" style="flex:1" data-ajout="${p.id}" data-depuis-vue ${enRupture(p) ? "disabled" : ""}>
            ${p.precommande ? "Précommander" : { pokemon: "Ajouter au sac", onepiece: "Embarquer", yugioh: "Ajouter au deck" }[p.jeu]}
          </button>
        </div>
      </div>`;
    dialogue.showModal();
  }
  dialogue.addEventListener("click", (e) => {
    if (e.target === dialogue || e.target.closest("[data-fermer]")) dialogue.close();
    const d = e.target.closest("[data-qv]");
    if (d) {
      qteVue = Math.max(1, qteVue + Number(d.dataset.qv));
      $("#qv").textContent = qteVue;
    }
  });

  // ---------- Panier ----------
  let panier = {};
  try { panier = JSON.parse(localStorage.getItem(CLE_PANIER)) || {}; } catch { panier = {}; }
  for (const id of Object.keys(panier)) if (!parId(id)) delete panier[id];

  function sauverPanier() {
    try { localStorage.setItem(CLE_PANIER, JSON.stringify(panier)); } catch { /* stockage indisponible */ }
  }
  function maxPour(p) { return p.stock == null ? 99 : p.stock; }

  function ajouter(id, qte = 1) {
    const p = parId(id);
    if (!p || enRupture(p)) return;
    const avant = panier[id] || 0;
    panier[id] = Math.min(maxPour(p), avant + qte);
    sauverPanier();
    rendrePanier();
    const badge = $("#panier-compte");
    badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
    toast(panier[id] === avant ? `Stock maximum atteint pour ${p.nom}` : `${p.nom} ajouté au panier`);
  }

  function rendrePanier() {
    const lignes = Object.entries(panier).filter(([, q]) => q > 0);
    const nb = lignes.reduce((s, [, q]) => s + q, 0);
    const total = lignes.reduce((s, [id, q]) => s + parId(id).prix * q, 0);
    $("#panier-compte").textContent = nb;
    $("#panier-total").textContent = chf(total);
    $("#commander").disabled = nb === 0;
    $("#panier-liste").innerHTML = lignes.length ? lignes.map(([id, q]) => {
      const p = parId(id);
      return `<div class="ligne-panier">
        <div class="mini">${vignette(p)}</div>
        <div>
          <h4>${echapper(p.nom)}${drapeau(p)}</h4>
          <div class="qte"><button data-q="${id}" data-d="-1" aria-label="Moins">−</button><span>${q}</span><button data-q="${id}" data-d="1" aria-label="Plus">+</button></div>
        </div>
        <div class="droite"><strong>${chf(p.prix * q)}</strong><button class="lien" data-retirer="${id}">Retirer</button></div>
      </div>`;
    }).join("") : `<p class="panier-vide">Votre panier est vide.</p>`;
    const reste = LIVRAISON_OFFERTE - total;
    $("#livraison").innerHTML = nb === 0 ? "" :
      (reste > 0 ? `Plus que <strong>${chf(reste)}</strong> pour la livraison offerte` : `🎉 Livraison offerte !`) +
      `<div class="jauge"><i style="width:${Math.min(100, (total / LIVRAISON_OFFERTE) * 100)}%"></i></div>`;
  }

  const tiroir = $("#panier"), voile = $("#voile"), filtres = $("#filtres");
  function ouvrirPanier() { tiroir.classList.add("ouvert"); tiroir.setAttribute("aria-hidden", "false"); voile.hidden = false; }
  function fermerTout() {
    tiroir.classList.remove("ouvert"); tiroir.setAttribute("aria-hidden", "true");
    filtres.classList.remove("ouvert"); voile.hidden = true;
  }

  $("#panier-liste").addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]");
    const r = e.target.closest("[data-retirer]");
    if (q) {
      const p = parId(q.dataset.q);
      panier[p.id] = Math.min(maxPour(p), (panier[p.id] || 0) + Number(q.dataset.d));
      if (panier[p.id] <= 0) delete panier[p.id];
    }
    if (r) delete panier[r.dataset.retirer];
    if (q || r) { sauverPanier(); rendrePanier(); }
  });
  $("#commander").addEventListener("click", () => toast("Le paiement en ligne sera bientôt disponible."));

  // ---------- Toast ----------
  let minuteur;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("visible");
    clearTimeout(minuteur);
    minuteur = setTimeout(() => t.classList.remove("visible"), 2200);
  }

  // ---------- Événements ----------
  document.addEventListener("click", (e) => {
    const jeu = e.target.closest("[data-jeu]");
    if (jeu) { e.preventDefault(); changerJeu(jeu.dataset.jeu); return; }
    const vue = e.target.closest("[data-vue]");
    if (vue) { ouvrirVue(vue.dataset.vue); return; }
    const ajout = e.target.closest("[data-ajout]");
    if (ajout) {
      const depuisVue = ajout.hasAttribute("data-depuis-vue");
      ajouter(ajout.dataset.ajout, depuisVue ? qteVue : 1);
      if (depuisVue) { dialogue.close(); ouvrirPanier(); }
      return;
    }
    const page = e.target.closest("[data-page]");
    if (page && !page.disabled) {
      etat.page = Number(page.dataset.page);
      rendre();
      $("#hero").scrollIntoView({ behavior: "smooth" });
    }
  });

  $("#f-types").addEventListener("change", (e) => {
    e.target.checked ? etat.types.add(e.target.value) : etat.types.delete(e.target.value);
    etat.page = 1; rendre();
  });
  const nombre = (v) => (v === "" ? null : Number(v));
  $("#prix-min").addEventListener("input", (e) => { etat.min = nombre(e.target.value); etat.page = 1; rendre(); });
  $("#prix-max").addEventListener("input", (e) => { etat.max = nombre(e.target.value); etat.page = 1; rendre(); });
  $("#f-dispo").addEventListener("change", (e) => { etat.dispo = e.target.checked; etat.page = 1; rendre(); });
  $("#f-precommande").addEventListener("change", (e) => { etat.precommande = e.target.checked; etat.page = 1; rendre(); });
  $("#tri").addEventListener("change", (e) => { etat.tri = e.target.value; etat.page = 1; rendre(); });
  $("#recherche").addEventListener("input", (e) => { etat.recherche = e.target.value; etat.page = 1; rendre(); });
  $("#reset").addEventListener("click", () => {
    Object.assign(etat, { types: new Set(), min: null, max: null, dispo: false, precommande: false, page: 1 });
    ["#prix-min", "#prix-max"].forEach((s) => ($(s).value = ""));
    ["#f-dispo", "#f-precommande"].forEach((s) => ($(s).checked = false));
    rendreFiltresTypes(); rendre();
  });

  $("#ouvrir-panier").addEventListener("click", ouvrirPanier);
  $("#fermer-panier").addEventListener("click", fermerTout);
  $("#ouvrir-filtres").addEventListener("click", () => { filtres.classList.add("ouvert"); voile.hidden = false; });
  $("#appliquer-filtres").addEventListener("click", fermerTout);
  voile.addEventListener("click", fermerTout);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerTout(); });
  window.addEventListener("popstate", () => { lireUrl(); rendreFiltresTypes(); rendre(); });

  // ---------- Démarrage ----------
  $("#annee").textContent = new Date().getFullYear();
  lireUrl();
  rendreFiltresTypes();
  rendre();
  rendrePanier();
})();
