// Génère une paire de clés VAPID pour les notifications Web Push.
// Usage : node scripts/generate-vapid.mjs
// Copie ensuite les valeurs dans .env.local (ne JAMAIS committer la clé privée).
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log("VAPID_SUBJECT=mailto:contact@rysao.app");
