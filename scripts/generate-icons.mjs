import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const appIconDir = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const splashDir = join(root, 'ios/App/App/Assets.xcassets/Splash.imageset');

const BG = '#080b10';
const ACCENT = '#00d4e8';

function iconSvg(size) {
  const rx = Math.round(size * 0.08);
  const border = Math.max(2, Math.round(size * 0.014));
  const glyphSize = Math.round(size * 0.52);
  const glyphY = Math.round(size * 0.58);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BG}"/>
  <rect x="${border}" y="${border}" width="${size - border * 2}" height="${size - border * 2}" rx="${Math.max(0, rx - border)}" fill="none" stroke="${ACCENT}" stroke-width="${border}"/>
  <text x="${size / 2}" y="${glyphY}" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="${glyphSize}" fill="${ACCENT}">¶</text>
</svg>`);
}

function splashSvg(size) {
  const logoSize = Math.round(size * 0.22);
  const logoX = Math.round((size - logoSize) / 2);
  const logoY = Math.round((size - logoSize) / 2);
  const border = Math.max(2, Math.round(logoSize * 0.014));
  const glyphSize = Math.round(logoSize * 0.52);
  const glyphY = logoY + Math.round(logoSize * 0.58);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <rect x="${logoX + border}" y="${logoY + border}" width="${logoSize - border * 2}" height="${logoSize - border * 2}" fill="none" stroke="${ACCENT}" stroke-width="${border}"/>
  <text x="${logoX + logoSize / 2}" y="${glyphY}" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="${glyphSize}" fill="${ACCENT}">¶</text>
</svg>`);
}

async function writePng(path, svgBuffer) {
  await sharp(svgBuffer)
    .flatten({ background: BG })
    .png({ force: true })
    .toFile(path);
  console.log(`Wrote ${path}`);
}

await mkdir(publicDir, { recursive: true });
await mkdir(appIconDir, { recursive: true });
await mkdir(splashDir, { recursive: true });

await writePng(join(publicDir, 'icon-192.png'), iconSvg(192));
await writePng(join(publicDir, 'icon-512.png'), iconSvg(512));
await writePng(join(publicDir, 'apple-touch-icon.png'), iconSvg(180));
await writePng(join(appIconDir, 'AppIcon-512@2x.png'), iconSvg(1024));

const splashSize = 2732;
const splashBuffer = splashSvg(splashSize);
await writePng(join(splashDir, 'splash-2732x2732.png'), splashBuffer);
await writePng(join(splashDir, 'splash-2732x2732-1.png'), splashBuffer);
await writePng(join(splashDir, 'splash-2732x2732-2.png'), splashBuffer);
