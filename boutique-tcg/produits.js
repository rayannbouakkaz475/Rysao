// Catalogue de la boutique. Pour ajouter un produit, copie une ligne et adapte-la.
// type : display | etb | coffret | pokebox | accessoire | blister
// stock : nombre d'exemplaires (0 = rupture, null = en stock sans quantité affichée). precommande : true si pas encore sorti.
// image : chemin vers une photo (laisser vide pour la vignette générée).
window.PRODUITS = [
  // Pokémon
  { id: "display-me5", nom: "Display ME5", jeu: "pokemon", type: "display", langue: "fr", prix: 199.90, stock: null, image: "",
    description: "Display de boosters de l'extension ME5." },
  { id: "etb-me5", nom: "Élite Trainer Box ME5", jeu: "pokemon", type: "etb", langue: "fr", prix: 69.90, stock: null, image: "",
    description: "Coffret Dresseur d'Élite de l'extension ME5." },
  { id: "etb-ev7", nom: "Élite Trainer Box EV7", jeu: "pokemon", type: "etb", langue: "fr", prix: 54.90, stock: null, image: "",
    description: "Coffret Dresseur d'Élite de l'extension Écarlate et Violet EV7." },
  { id: "coffret-zygarde", nom: "Coffret Zygarde", jeu: "pokemon", type: "coffret", langue: "fr", prix: 59.90, stock: null, image: "",
    description: "Coffret collection Zygarde." },
  { id: "pokebox-ectoplasma-melodelfe", nom: "Pokebox Ectoplasma / Mélodelfe", jeu: "pokemon", type: "pokebox", langue: "fr", prix: 25.90, stock: null, image: "",
    description: "Pokebox Ectoplasma ou Mélodelfe." },
  { id: "coffret-scalpereur", nom: "Coffret Scalpereur 6.5", jeu: "pokemon", type: "coffret", langue: "fr", prix: 24.90, stock: 4, precommande: true, image: "",
    description: "Coffret Scalpereur de l'extension 6.5." },
  { id: "coffret-dogrino", nom: "Coffret Dogrino", jeu: "pokemon", type: "coffret", langue: "fr", prix: 24.90, stock: 8, image: "",
    description: "4 boosters, 1 carte jumbo et 2 cartes promo." },
  { id: "pokebox-zacian", nom: "Pokebox Zacian", jeu: "pokemon", type: "pokebox", langue: "fr", prix: 24.90, stock: 2, image: "",
    description: "4 boosters et 1 carte promo Zacian." },
  { id: "coffret-superdofin", nom: "Coffret Superdofin", jeu: "pokemon", type: "coffret", langue: "fr", prix: 24.90, stock: 12, precommande: true, sortie: "21 juin", image: "",
    description: "4 boosters et 1 carte promo Superdofin." },
  { id: "tapis-pikachu", nom: "Tapis Pikachu", jeu: "pokemon", type: "accessoire", langue: "", prix: 24.90, stock: null, image: "",
    description: "Tapis de jeu illustré Pikachu ⚡️." },

  // One Piece
  { id: "display-op12", nom: "Display OP12", jeu: "onepiece", type: "display", langue: "fr", prix: 124.90, stock: null, image: "",
    description: "Display de boosters One Piece Card Game OP12." },
  { id: "display-op14", nom: "Display OP14", jeu: "onepiece", type: "display", langue: "fr", prix: 124.90, stock: null, image: "",
    description: "Display de boosters One Piece Card Game OP14." },

  // Yu-Gi-Oh
  { id: "display-yugioh", nom: "Display Yu-Gi-Oh", jeu: "yugioh", type: "display", langue: "fr", prix: 109.90, stock: null, image: "",
    description: "Boîte de boosters Yu-Gi-Oh! JCC." },
  { id: "blister-yugioh", nom: "Blister Yu-Gi-Oh", jeu: "yugioh", type: "blister", langue: "fr", prix: 4.90, stock: null, image: "",
    description: "Booster Yu-Gi-Oh! sous blister." }
];

window.JEUX = {
  pokemon: { nom: "Pokémon", emoji: "🐉" },
  onepiece: { nom: "One Piece", emoji: "🏴‍☠️" },
  yugioh: { nom: "Yu-Gi-Oh", emoji: "🃏" }
};

window.TYPES = {
  display: "Display",
  etb: "Élite Trainer Box",
  coffret: "Coffret",
  pokebox: "Pokebox",
  blister: "Blister",
  accessoire: "Accessoire"
};
