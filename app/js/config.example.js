/* RYSAO TCG — configuration backend (exemple)
   Copie ce fichier en `config.js`, renseigne tes valeurs Supabase, puis ajoute
   <script src="./js/config.js"></script> AVANT backend.js dans index.html.
   (Ne committe pas config.js si le dépôt est public.) */
window.RYSAO_CONFIG = {
  supabaseUrl: "https://VOTRE-PROJET.supabase.co",
  supabaseKey: "VOTRE_CLE_ANON_PUBLIC",
  // clé publique VAPID pour les push (npx web-push generate-vapid-keys)
  vapidPublicKey: "",
  // optionnel : clé pokemontcg.io pour des prix live à plus haut débit
  pokemontcgKey: "",
};
