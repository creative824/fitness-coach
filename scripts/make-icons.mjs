// Generates PWA icons from an inline SVG. Run: node scripts/make-icons.mjs
import sharp from "sharp";

const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#246b4a"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 0.9})">
    <circle r="150" fill="none" stroke="#2f8a60" stroke-width="44"/>
    <path d="M 0 -150 A 150 150 0 1 1 -129.9 75" fill="none" stroke="#c9f36a" stroke-width="44" stroke-linecap="round"/>
    <path d="M -58 4 L -14 48 L 66 -40" fill="none" stroke="#ffffff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
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
