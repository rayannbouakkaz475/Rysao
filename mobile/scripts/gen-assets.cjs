/* Génère les visuels SOURCE (icône + splash) dans mobile/assets/ via Chromium.
   Thème : carte holographique « R » de rareté (foil, étoiles, éventail, éclats).
   Icône = uniquement le « R » (pas de nom). Splash = emblème + petit wordmark.
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

const HOLO = "linear-gradient(135deg,#00e0c6,#4ea8ff 28%,#7c5cff 55%,#ff5cc6 78%,#ffd23f)";

// Fond : halo holographique + rayons + dégradé sombre de marque
const BG = `
  repeating-conic-gradient(from 0deg at 50% 46%, rgba(255,255,255,.05) 0deg 5deg, transparent 5deg 11deg),
  radial-gradient(circle at 50% 46%, rgba(0,224,198,.30), transparent 46%),
  radial-gradient(circle at 50% 46%, rgba(124,92,255,.45), transparent 68%),
  linear-gradient(160deg,#141d4a,#0b1020)`;

function sparkle(x, y, s, o = 1) {
  return `<div style="position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);
    font-size:${s}px;color:#fff;opacity:${o};text-shadow:0 0 ${s * 0.7}px rgba(0,224,198,.9)">✦</div>`;
}

// Carte holographique : bordure foil + panneau sombre + grand R
function rCard(w, { rot = 0, dx = 0, dy = 0, z = 2, full = true } = {}) {
  const h = w * 1.4, pad = w * 0.05, rad = w * 0.11;
  const inner = full ? `
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
        <span style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:${w * 0.92}px;line-height:1;
          background:${HOLO};-webkit-background-clip:text;background-clip:text;color:transparent;
          filter:drop-shadow(0 ${w * 0.02}px ${w * 0.06}px rgba(0,224,198,.45))">R</span>
      </div>
      <div style="position:absolute;top:${w * 0.08}px;left:0;right:0;text-align:center;letter-spacing:${w * 0.03}px;
        font-size:${w * 0.1}px;color:#ffd23f;text-shadow:0 0 ${w * 0.04}px rgba(255,210,63,.8)">★★★</div>` : "";
  return `
  <div style="position:absolute;left:50%;top:50%;width:${w}px;height:${h}px;
    margin-left:${-w / 2}px;margin-top:${-h / 2}px;border-radius:${rad}px;background:${HOLO};
    transform:translate(${dx}px,${dy}px) rotate(${rot}deg);z-index:${z};
    box-shadow:0 ${w * 0.08}px ${w * 0.2}px rgba(0,0,0,.6);padding:${pad}px;box-sizing:border-box">
    <div style="position:relative;width:100%;height:100%;border-radius:${rad * 0.75}px;overflow:hidden;
      background:linear-gradient(165deg,#161f३f,#0b1020)">
      ${inner}
      <div style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.55) 0%,transparent 32%,transparent 68%,rgba(255,255,255,.18) 100%)"></div>
    </div>
  </div>`.replace("३f", "3f");
}

// Scène : éventail (2 cartes foil derrière) + carte R devant + étincelles
function scene(w) {
  return `<div style="position:relative;width:${w * 2.6}px;height:${w * 2.0}px">
    ${rCard(w * 0.9, { rot: -17, dx: -w * 0.6, dy: w * 0.12, z: 1, full: false })}
    ${rCard(w * 0.9, { rot: 17, dx: w * 0.6, dy: w * 0.12, z: 1, full: false })}
    ${rCard(w, { rot: -4, dx: 0, dy: -w * 0.05, z: 3 })}
    ${sparkle(20, 22, w * 0.18)}
    ${sparkle(82, 30, w * 0.12, 0.9)}
    ${sparkle(76, 74, w * 0.16)}
    ${sparkle(24, 78, w * 0.1, 0.8)}
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
    <div style="width:1024px;height:1024px;display:grid;place-items:center;background:${BG};overflow:hidden">${scene(300)}</div>` },

  "icon-background.png": { w: 1024, h: 1024, omit: false, html: `
    <div style="width:1024px;height:1024px;background:${BG}"></div>` },

  "icon-foreground.png": { w: 1024, h: 1024, omit: true, html: `
    <div style="width:1024px;height:1024px;display:grid;place-items:center;background:transparent">${scene(250)}</div>` },

  "splash.png": { w: 2732, h: 2732, omit: false, html: `
    <div style="width:2732px;height:2732px;display:grid;place-items:center;background:${BG}">
      <div style="display:flex;flex-direction:column;align-items:center;gap:120px">
        ${scene(340)}
        ${wordmark(140)}
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
