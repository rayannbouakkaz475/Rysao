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
      nom: j.nom, filtre: (p) => p.jeu === k,
      sousTitre: `Tous nos produits scellés ${j.nom} : displays, coffrets et plus.`
    }])),
    precommandes: {
      nom: "Précommandes", filtre: (p) => p.precommande,
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
  // Packshots : chaque produit est dessiné comme une vraie boîte scellée en 3D (CSS),
  // avec une teinte propre au produit, un reflet de film plastique et une ombre portée.
  const MARQUES = {
    pokemon: { marque: "POKÉMON", sous: "Jeu de cartes à collectionner" },
    onepiece: { marque: "ONE PIECE", sous: "Card Game" },
    yugioh: { marque: "YU-GI-OH!", sous: "Trading Card Game" }
  };
  // Teintes possibles par univers (hue HSL) : chaque produit en tire une, de façon stable.
  const TEINTES = {
    pokemon: [218, 262, 192, 352, 24, 140],
    onepiece: [354, 212, 32, 168],
    yugioh: [272, 228, 2, 44]
  };
  // Dimensions (en % de la largeur de la vignette) : largeur, hauteur, profondeur.
  const FORMES = {
    display: [60, 40, 33],
    etb: [44, 51, 26],
    coffret: [64, 42, 13],
    pokebox: [48, 45, 18],
    blister: [40, 60, 3],
    accessoire: [72, 44, 1]
  };
  const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const teinte = (p) => p.teinte ?? TEINTES[p.jeu][hash(p.id) % TEINTES[p.jeu].length];
  const codeProduit = (p) => p.nom.replace(/^(Display|Élite Trainer Box|Coffret|Pokebox|Tapis|Blister)\s*/i, "") || p.nom;

  // Emblèmes en traits fins (aucun logo officiel).
  const EMBLEMES = {
    pokemon: `<svg viewBox="0 0 100 100" class="ico"><circle cx="50" cy="50" r="46"/><path d="M4 50h30M66 50h30"/><circle cx="50" cy="50" r="16"/><circle cx="50" cy="50" r="7"/></svg>`,
    onepiece: `<svg viewBox="0 0 100 100" class="ico"><circle cx="50" cy="50" r="44"/><circle cx="50" cy="50" r="34" stroke-dasharray="2 4"/><path d="M50 2v96M2 50h96M18 18l64 64M82 18 18 82" stroke-width=".8"/><path d="M50 10l7 40-7 40-7-40z" fill="currentColor" fill-opacity=".35"/><path d="M10 50l40-7 40 7-40 7z" fill="currentColor" fill-opacity=".2"/></svg>`,
    yugioh: `<svg viewBox="0 0 100 100" class="ico"><path d="M50 6 94 88H6z"/><path d="M50 22 80 78H20z" stroke-width=".8"/><path d="M30 62q20-20 40 0q-20 20-40 0z"/><circle cx="50" cy="62" r="6" fill="currentColor"/></svg>`
  };

  const booster = (i) => `<span class="booster" style="--i:${i}"><span class="booster-art"></span></span>`;

  function faceAvant(p) {
    const m = MARQUES[p.jeu];
    const code = codeProduit(p);
    const classeCode = `art-code${code.length > 8 ? " long" : ""}`;
    const fenetre = p.type === "coffret" || p.type === "pokebox"
      ? `<span class="fenetre">${booster(0)}${booster(1)}${booster(2)}</span>` : "";
    if (p.type === "blister") {
      return `<div class="art art-${p.jeu} art-blister">
        <span class="trou"></span>
        <span class="art-marque">${m.marque}</span>
        <span class="bulle">${booster(0)}</span>
        <span class="${classeCode}">${echapper(code)}</span>
        <span class="reflet"></span>
      </div>`;
    }
    return `<div class="art art-${p.jeu} art-${p.type}">
      <span class="embleme">${EMBLEMES[p.jeu]}</span>
      <span class="art-tete"><span class="art-marque">${m.marque}</span><span class="art-sous">${m.sous}</span></span>
      ${fenetre}
      <span class="art-pied">
        <span class="art-type">${TYPES[p.type]}</span>
        <span class="${classeCode}">${echapper(code)}</span>
      </span>
      <span class="reflet"></span>
    </div>`;
  }

  function packshot(p) {
    if (p.image) return `<img src="${echapper(p.image)}" alt="${echapper(p.nom)}" loading="lazy">`;
    const [w, h, d] = FORMES[p.type] || FORMES.coffret;
    const m = MARQUES[p.jeu];
    return `<div class="scene scene-${p.jeu}" style="--t:${teinte(p)}" role="img" aria-label="${echapper(p.nom)}">
      <div class="objet forme-${p.type}" style="--w:${w}em;--h:${h}em;--d:${d}em">
        <div class="face avant">${faceAvant(p)}</div>
        <div class="face cote"><span>${m.marque} · ${echapper(codeProduit(p))}</span></div>
        <div class="face dessus"></div>
      </div>
      <div class="ombre" style="--w:${w}em;--h:${h}em;--d:${d}em"></div>
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

  const langue = (p) => (p.langue ? ` <span class="langue" title="Version française">${p.langue.toUpperCase()}</span>` : "");

  const visuel = (p) => `<button class="visuel" data-vue="${p.id}" aria-label="Vue rapide : ${echapper(p.nom)}">
      ${packshot(p)}${badges(p)}<span class="vue-rapide-btn">Vue rapide</span></button>`;
  const ajout = (p) => `<button class="btn btn-plein btn-ajout" data-ajout="${p.id}"
      ${enRupture(p) ? "disabled" : ""} aria-label="Ajouter ${echapper(p.nom)} au panier">
      <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>`;

  const carte = (p) => `<article class="produit u-${p.jeu}">
      ${visuel(p)}
      <div class="produit-info">
        <span class="produit-jeu">${JEUX[p.jeu].nom} · ${TYPES[p.type]}${langue(p)}</span>
        <h3 class="produit-nom"><button data-vue="${p.id}">${echapper(p.nom)}</button></h3>
        <div class="produit-bas">
          <div class="produit-prix"><span class="prix">${chf(p.prix)}</span>${stock(p)}</div>
          ${ajout(p)}
        </div>
      </div>
    </article>`;

  function rendreNav() {
    const compte = (onglet) => PRODUITS.filter((p) => dansOnglet(p, onglet)).length;
    const items = [["tous", "Tous"], ...Object.entries(ONGLETS).map(([k, o]) => [k, o.nom])];
    $("#nav-jeux").innerHTML = items.map(([k, nom]) =>
      `<button data-jeu="${k}" class="onglet-${k}" aria-pressed="${etat.jeu === k}"><i class="pastille"></i>${nom} <small>${compte(k)}</small></button>`
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

  const UNIVERS = {
    pokemon: { slogan: "Les dernières extensions, scellées et en version française.", texte: "Displays, Élite Trainer Box, coffrets et Pokebox." },
    onepiece: { slogan: "Les extensions du One Piece Card Game.", texte: "Displays scellés, directement des distributeurs officiels." },
    yugioh: { slogan: "De quoi renforcer chaque deck.", texte: "Displays et blisters Yu-Gi-Oh! JCC." },
    precommandes: { slogan: "Réserve les prochaines sorties.", texte: "Pokémon, One Piece et Yu-Gi-Oh réunis. Expédition dès l'arrivée du stock." }
  };
  // Le produit mis en avant dans une bannière : le plus cher de la sélection.
  const vedette = (filtre) => PRODUITS.filter(filtre).sort((a, b) => b.prix - a.prix)[0];

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
          <span class="surtitre">Boutique suisse · Produits scellés</span>
          <h1>Trois univers, une seule adresse.</h1>
          <p>Pokémon, One Piece et Yu-Gi-Oh, authentiques et expédiés depuis la Suisse.</p>
        </div>
        <div class="portails">${Object.entries(JEUX).map(([k, jeu]) => {
          const v = vedette((p) => p.jeu === k);
          return `<button class="portail portail-${k}" data-jeu="${k}">
            <span class="portail-scene">${v ? packshot(v) : ""}</span>
            <span class="portail-txt">
              <strong>${jeu.nom}</strong>
              <em>${UNIVERS[k].slogan}</em>
              <span class="portail-cta">Découvrir ${PRODUITS.filter((p) => p.jeu === k).length} produits <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
            </span>
          </button>`;
        }).join("")}
        </div>`;
      return;
    }
    const v = vedette((p) => dansOnglet(p, etat.jeu));
    $("#hero").innerHTML = `
      <div class="banniere banniere-${etat.jeu}">
        <div class="banniere-txt">
          <span class="surtitre">${etat.jeu === "precommandes" ? "Bientôt disponible" : "Univers"}</span>
          <h1>${j.nom}</h1>
          <p class="slogan">${u.slogan}</p>
          <p>${u.texte}</p>
        </div>
        ${v ? `<button class="banniere-scene" data-vue="${v.id}" aria-label="Voir ${echapper(v.nom)}">${packshot(v)}
          <span class="banniere-legende">${echapper(v.nom)} · ${chf(v.prix)}</span></button>` : ""}
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
        <header class="groupe-tete">
          <h2>${jeu.nom}</h2>
          <span class="groupe-compte">${items.length ? `${items.length} précommande${items.length > 1 ? "s" : ""}` : "Aucune pour l'instant"}</span>
          <button class="groupe-lien" data-jeu="${k}">Voir l'univers ${jeu.nom} <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </header>
        ${items.length
          ? `<div class="grille">${items.map(carte).join("")}</div>`
          : `<p class="groupe-vide">Les prochaines sorties ${jeu.nom} apparaîtront ici dès leur annonce.</p>`}
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
      <div class="visuel">${packshot(p)}${badges(p)}</div>
      <div class="modale-infos">
        <span class="produit-jeu">${JEUX[p.jeu].nom} · ${TYPES[p.type]}${langue(p)}</span>
        <h2>${echapper(p.nom)}</h2>
        <span class="prix">${chf(p.prix)}</span>
        ${stock(p)}
        <p>${echapper(p.description || "")}</p>
        ${p.precommande ? `<p><strong>Précommande</strong>${p.sortie ? " — sortie prévue le " + echapper(p.sortie) : ""}. Expédié dès réception.</p>` : ""}
        <div class="quantite">
          <div class="qte"><button data-qv="-1" aria-label="Moins">−</button><span id="qv">1</span><button data-qv="1" aria-label="Plus">+</button></div>
          <button class="btn btn-plein" style="flex:1" data-ajout="${p.id}" data-depuis-vue ${enRupture(p) ? "disabled" : ""}>
            ${p.precommande ? "Précommander" : "Ajouter au panier"}
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
        <div class="mini">${packshot(p)}</div>
        <div>
          <h4>${echapper(p.nom)}</h4>
          <div class="qte"><button data-q="${id}" data-d="-1" aria-label="Moins">−</button><span>${q}</span><button data-q="${id}" data-d="1" aria-label="Plus">+</button></div>
        </div>
        <div class="droite"><strong>${chf(p.prix * q)}</strong><button class="lien" data-retirer="${id}">Retirer</button></div>
      </div>`;
    }).join("") : `<p class="panier-vide">Votre panier est vide.</p>`;
    const reste = LIVRAISON_OFFERTE - total;
    $("#livraison").innerHTML = nb === 0 ? "" :
      (reste > 0 ? `Plus que <strong>${chf(reste)}</strong> pour la livraison offerte` : `Livraison offerte`) +
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
