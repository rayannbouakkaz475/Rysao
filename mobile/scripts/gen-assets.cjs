/* Génère les visuels SOURCE (icône + splash) dans mobile/assets/ via Chromium,
   à partir de l'artwork fourni (assets/source-art.png).
   Sorties (conventions @capacitor/assets) :
     icon-only.png, icon-foreground.png, icon-background.png  (1024x1024)
     splash.png, splash-dark.png                              (2732x2732)
   Lancer :  node scripts/gen-assets.cjs
*/
const path = require("path");
const fs = require("fs");
const { chromium } = require(process.env.PW || "/opt/node22/lib/node_modules/playwright");

const OUT = path.join(__dirname, "..", "assets");
const ART = path.join(OUT, "source-art.png");
fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(ART)) { console.error("Manque assets/source-art.png"); process.exit(1); }
const dataURL = "data:image/png;base64," + fs.readFileSync(ART).toString("base64");

const BG = "linear-gradient(160deg,#101a3a,#0b1020)";

const PAGES = {
  // Icône complète : artwork plein cadre (l'OS applique son propre arrondi)
  "icon-only.png": { w: 1024, h: 1024, omit: false, html: `
    <div style="width:1024px;height:1024px;background:url('${dataURL}') center/cover no-repeat"></div>` },

  // Fond pour icône adaptive Android
  "icon-background.png": { w: 1024, h: 1024, omit: false, html: `
    <div style="width:1024px;height:1024px;background:${BG}"></div>` },

  // Avant-plan adaptive : artwork réduit dans la zone de sécurité, fond transparent
  "icon-foreground.png": { w: 1024, h: 1024, omit: true, html: `
    <div style="width:1024px;height:1024px;display:grid;place-items:center;background:transparent">
      <img src="${dataURL}" style="width:80%;height:80%;object-fit:contain;border-radius:6%">
    </div>` },

  // Splash : artwork centré sur fond de marque
  "splash.png": { w: 2732, h: 2732, omit: false, html: `
    <div style="width:2732px;height:2732px;display:grid;place-items:center;background:${BG}">
      <img src="${dataURL}" style="width:1180px;height:1180px;object-fit:contain;border-radius:60px;box-shadow:0 40px 120px rgba(0,0,0,.5)">
    </div>` },
};
PAGES["splash-dark.png"] = PAGES["splash.png"];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  for (const [name, p] of Object.entries(PAGES)) {
    const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0">${p.html}</body></html>`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, name), omitBackground: !!p.omit, clip: { x: 0, y: 0, width: p.w, height: p.h } });
    await page.close();
    console.log("✓", name, `${p.w}x${p.h}`);
  }
  await browser.close();
  console.log("Assets source écrits dans", OUT);
})();
