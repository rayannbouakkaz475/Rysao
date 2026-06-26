/* Génère les visuels SOURCE (icône + splash) dans mobile/assets/ via Chromium.
   Thème : éventail de cartes holographiques (TCG).
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
  radial-gradient(circle at 78% 14%, rgba(255,222,89,.16), transparent 42%),
  radial-gradient(circle at 16% 82%, rgba(124,92,255,.42), transparent 52%),
  radial-gradient(circle at 50% 55%, rgba(0,224,198,.12), transparent 60%),
  linear-gradient(160deg, #101a3a, #0b1020)`;

// Une carte holographique positionnée au centre puis transformée.
function card(w, { rot = 0, dx = 0, dy = 0, z = 1, grad, dim = 1 }) {
  const h = w * 1.4;
  return `
  <div style="position:absolute;left:50%;top:50%;width:${w}px;height:${h}px;
    margin-left:${-w / 2}px;margin-top:${-h / 2}px;
    border-radius:${w * 0.1}px;border:${w * 0.02}px solid rgba(255,255,255,.9);
    background:${grad};box-shadow:0 ${w * 0.07}px ${w * 0.18}px rgba(0,0,0,.55);
    transform:translate(${dx}px,${dy}px) rotate(${rot}deg);z-index:${z};
    filter:brightness(${dim});overflow:hidden">
    <div style="position:absolute;inset:9%;border:${w * 0.013}px solid rgba(255,255,255,.5);border-radius:${w * 0.055}px"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.6),transparent 42%)"></div>
    <div style="position:absolute;left:0;right:0;bottom:11%;text-align:center;font-family:Arial;font-weight:800;
      font-size:${w * 0.34}px;color:rgba(255,255,255,.92);text-shadow:0 2px 6px rgba(0,0,0,.3)">✦</div>
  </div>`;
}

// Éventail de 3 cartes (carte centrale = w)
function fan(w) {
  const s = w * 0.92;
  return `<div style="position:relative;width:${w * 2.4}px;height:${w * 1.9}px">
    ${card(s, { rot: -20, dx: -w * 0.62, dy: w * 0.10, z: 1, grad: "linear-gradient(150deg,#7c5cff,#4ea8ff 60%,#00e0c6)", dim: 0.9 })}
    ${card(s, { rot: 20,  dx:  w * 0.62, dy: w * 0.10, z: 1, grad: "linear-gradient(150deg,#ff5cc6,#ffd23f 75%)", dim: 0.9 })}
    ${card(w, { rot: 0,   dx: 0,         dy: -w * 0.06, z: 2, grad: "linear-gradient(150deg,#00e0c6,#4ea8ff 42%,#7c5cff 72%,#ff5cc6)" })}
  </div>`;
}

const wordmark = (size) => `
  <div style="display:flex;align-items:center;gap:${size * 0.16}px;font-family:Arial,Helvetica,sans-serif">
    <span style="font-weight:800;font-size:${size}px;letter-spacing:${size * 0.03}px;
      background:linear-gradient(90deg,#00e0c6,#7c5cff);-webkit-background-clip:text;background-clip:text;color:transparent">RYSAO</span>
    <span style="font-weight:800;font-size:${size * 0.46}px;color:#04231f;background:#00e0c6;padding:${size * 0.07}px ${size * 0.17}px;border-radius:${size * 0.12}px">CARDS</span>
  </div>`;

const PAGES = {
  "icon-only.png": { w: 1024, h: 1024, omit: false, html: `
    <div style="width:1024px;height:1024px;display:grid;place-items:center;background:${BG}">
      ${fan(300)}
    </div>` },

  "icon-background.png": { w: 1024, h: 1024, omit: false, html: `
    <div style="width:1024px;height:1024px;background:${BG}"></div>` },

  "icon-foreground.png": { w: 1024, h: 1024, omit: true, html: `
    <div style="width:1024px;height:1024px;display:grid;place-items:center;background:transparent">
      ${fan(250)}
    </div>` },

  "splash.png": { w: 2732, h: 2732, omit: false, html: `
    <div style="width:2732px;height:2732px;display:grid;place-items:center;background:${BG}">
      <div style="display:flex;flex-direction:column;align-items:center;gap:90px">
        ${fan(360)}
        ${wordmark(150)}
        <div style="color:#9aa6c6;font-size:58px;font-weight:500;letter-spacing:2px;font-family:Arial">Scan · Centrage · Gradation</div>
      </div>
    </div>` },
};
PAGES["splash-dark.png"] = PAGES["splash.png"];

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
