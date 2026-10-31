// Generates PWA icons from an inline SVG. Run: node scripts/make-icons.mjs
import sharp from "sharp";

const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="a" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#b4f53c"/><stop offset="1" stop-color="#14c4b4"/></linearGradient>
    <linearGradient id="b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0fae9c"/><stop offset="1" stop-color="#8ef03c"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#111412"/>
  <g transform="translate(256 256) scale(${pad ? 2.6 : 3.3}) translate(-51 -53)">
    <path d="M8 46 L18 25 C22 17 29 14 39 14 L95 12 L90 23 C85 34 77 38 66 38 L41 39 C34 39 30 41 27 46 Z" fill="url(#a)"/>
    <path d="M76 40 L60 77 C57 83 52 86 46 88 L30 94 L45 60 C50 48 57 41 67 40 Z" fill="url(#b)"/>
  </g>
</svg>`;

const out = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/apple-touch-icon.png", 180, true],
  ["public/icons/icon-maskable-512.png", 512, true],
];
for (const [file, size, maskable] of out) {
  await sharp(Buffer.from(mark(maskable))).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
