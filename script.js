// RYSAO — interactions
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("js-pret");


  /* --- Navigation solide au scroll --- */
  const header = document.querySelector("header.nav");
  const onScrollNav = () => {
    if (window.scrollY > 40) header.classList.add("solide");
    else header.classList.remove("solide");
  };
  onScrollNav();
  window.addEventListener("scroll", onScrollNav, { passive: true });

  /* --- Menu mobile --- */
  const boutonMenu = document.querySelector(".bouton-menu");
  const menuMobile = document.querySelector(".menu-mobile");
  if (boutonMenu && menuMobile) {
    const fermerMenu = () => {
      boutonMenu.classList.remove("ouvert");
      menuMobile.classList.remove("ouvert");
      boutonMenu.setAttribute("aria-expanded", "false");
    };
    boutonMenu.addEventListener("click", () => {
      const estOuvert = menuMobile.classList.toggle("ouvert");
      boutonMenu.classList.toggle("ouvert", estOuvert);
      boutonMenu.setAttribute("aria-expanded", String(estOuvert));
    });
    menuMobile.querySelectorAll("a").forEach((lien) => {
      lien.addEventListener("click", fermerMenu);
    });
  }

  /* --- Fil du temps : visible uniquement sur la section Collections --- */
  const fil = document.querySelector(".fil-temps");
  const sectionChapitres = document.querySelector(".chapitres");
  if (fil && sectionChapitres) {
    const curseur = fil.querySelector(".curseur");
    const etiquette = fil.querySelector(".etiquette");
    const chapitres = Array.from(document.querySelectorAll("[data-chapitre]"));

    chapitres.forEach((el, i) => {
      const repere = document.createElement("div");
      repere.className = "repere";
      repere.style.top = ((i) / (chapitres.length - 1)) * 100 + "%";
      fil.appendChild(repere);
    });

    const debut = chapitres[0];
    const fin = chapitres[chapitres.length - 1];

    const placerCurseur = () => {
      if (!debut || !fin) return;
      const rSection = sectionChapitres.getBoundingClientRect();
      const vh = window.innerHeight;
      const centre = vh / 2;
      fil.classList.toggle("actif", centre > rSection.top && centre < rSection.bottom);

      const r1 = debut.getBoundingClientRect();
      const r2 = fin.getBoundingClientRect();
      const y0 = r1.top + r1.height / 2;
      const y1 = r2.top + r2.height / 2;
      const total = y1 - y0;
      const avance = vh / 2 - y0;
      let pct = total !== 0 ? avance / total : 0;
      pct = Math.max(0, Math.min(1, pct));
      curseur.style.top = pct * 100 + "%";
      etiquette.style.top = pct * 100 + "%";
      const index = Math.round(pct * (chapitres.length - 1));
      etiquette.textContent = chapitres[index].getAttribute("data-chapitre");
    };

    placerCurseur();
    window.addEventListener("scroll", placerCurseur, { passive: true });
    window.addEventListener("resize", placerCurseur);
  }

  /* --- Révélation au défilement --- */
  const cibles = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observateur = new IntersectionObserver((entrees) => {
      entrees.forEach((entree) => {
        if (entree.isIntersecting) {
          entree.target.classList.add("visible");
          observateur.unobserve(entree.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
    cibles.forEach((el) => observateur.observe(el));
  } else {
    cibles.forEach((el) => el.classList.add("visible"));
  }

  /* --- Formulaire newsletter (présentation, sans envoi réel) --- */
  const formulaire = document.querySelector("form.lettre");
  if (formulaire) {
    formulaire.addEventListener("submit", (e) => {
      e.preventDefault();
      const confirmation = document.querySelector(".confirmation");
      const champ = formulaire.querySelector("input");
      if (champ && champ.value.trim().length > 3) {
        confirmation.style.display = "block";
        formulaire.reset();
      }
    });
  }

  /* --- Ancrage doux pour les liens internes --- */
  document.querySelectorAll('a[href^="#"]').forEach((lien) => {
    lien.addEventListener("click", (e) => {
      const cible = document.querySelector(lien.getAttribute("href"));
      if (cible) {
        e.preventDefault();
        cible.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
});
