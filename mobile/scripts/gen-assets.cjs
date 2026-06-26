/* Génère les visuels SOURCE (icône + splash) dans mobile/assets/ via Chromium.
   Sorties (conventions @capacitor/assets) :
     icon-only.png, icon-foreground.png, icon-background.png  (1024x1024)
     splash.png, splash-dark.png                              (2732x2732)
   Lancer :  node scripts/gen-assets.cjs
*/
const path = require("path");
const fs = require("fs");
const { chromium } = require(process.env.PW || "/opt/node22/lib/node_modules/playwright");

const OUT = path.join(__dirname, "..", "assets");
fs.mkdirSync(OUT, { recursive: true });

const BG = `
  radial-gradient(circle at 78% 14%, rgba(255,222,89,.18), transparent 42%),
  radial-gradient(circle at 16% 82%, rgba(124,92,255,.45), transparent 52%),
  radial-gradient(circle at 50% 50%, rgba(0,224,198,.10), transparent 60%),
  linear-gradient(160deg, #101a3a, #0b1020)`;

const monogram = (size) => `
  <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;
    font-size:${size}px;line-height:1;letter-spacing:-2px;
    background:linear-gradient(135deg,#00e0c6,#7c5cff);
    -webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 8px 30px rgba(0,224,198,.25))">R</div>`;

const PAGES = {
  // Icône complète (fond + R)
  "icon-only.png": { w: 1024, h: 1024, omit: false, html: `
    <div style="width:1024px;height:1024px;display:grid;place-items:center;background:${BG}">
      ${monogram(640)}
    </div>` },

  // Fond seul pour icône adaptive Android
  "icon-background.png": { w: 1024, h: 1024, omit: false, html: `
    <div style="width:1024px;height:1024px;background:${BG}"></div>` },

  // Premier plan (R) centré dans la zone de sécurité, fond transparent
  "icon-foreground.png": { w: 1024, h: 1024, omit: true, html: `
    <div style="width:1024px;height:1024px;display:grid;place-items:center;background:transparent">
      ${monogram(520)}
    </div>` },

  // Splash (clair = notre thème sombre de marque)
  "splash.png": { w: 2732, h: 2732, omit: false, html: `
    <div style="width:2732px;height:2732px;display:grid;place-items:center;background:${BG}">
      <div style="display:flex;flex-direction:column;align-items:center;gap:40px;font-family:Arial,Helvetica,sans-serif">
        ${monogram(360)}
        <div style="display:flex;align-items:center;gap:24px">
          <span style="font-weight:800;font-size:150px;letter-spacing:6px;
            background:linear-gradient(90deg,#00e0c6,#7c5cff);-webkit-background-clip:text;background-clip:text;color:transparent">RYSAO</span>
          <span style="font-weight:800;font-size:70px;color:#04231f;background:#00e0c6;padding:10px 26px;border-radius:18px">TCG</span>
        </div>
        <div style="color:#9aa6c6;font-size:58px;font-weight:500;letter-spacing:2px">Scan · Centrage · Gradation</div>
      </div>
    </div>` },
};
PAGES["splash-dark.png"] = PAGES["splash.png"]; // identique (thème déjà sombre)

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  for (const [name, p] of Object.entries(PAGES)) {
    const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0">${p.html}</body></html>`, { waitUntil: "load" });
    await page.screenshot({ path: path.join(OUT, name), omitBackground: !!p.omit, clip: { x: 0, y: 0, width: p.w, height: p.h } });
    await page.close();
    console.log("✓", name, `${p.w}x${p.h}`);
  }
  await browser.close();
  console.log("Assets source écrits dans", OUT);
})();
