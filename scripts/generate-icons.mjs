// Génère les PNG d'icône à partir de public/icon.svg
// Usage : node scripts/generate-icons.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";

const root = process.cwd();
const svg = fs.readFileSync(path.join(root, "public/icon.svg"));
const pub = path.join(root, "public");

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "badge.png", size: 96 },
];

for (const t of targets) {
  await sharp(svg, { density: 384 })
    .resize(t.size, t.size)
    .png()
    .toFile(path.join(pub, t.file));
  console.log("✓", t.file);
}

// Version "maskable" : ballon sur fond plein avec marge de sécurité
const maskable = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2ee6a6"/><stop offset="1" stop-color="#4f8cff"/>
  </linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="256" cy="256" r="120" fill="#ffffff"/>
  <polygon points="256,206 297,236 281,284 231,284 215,236" fill="#0b1120"/>
</svg>`;
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(path.join(pub, "icon-maskable.png"));
console.log("✓ icon-maskable.png");
