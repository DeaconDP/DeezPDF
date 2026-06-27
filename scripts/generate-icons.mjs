import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const appIconDir = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const splashDir = join(root, 'ios/App/App/Assets.xcassets/Splash.imageset');

const BG = '#060810';
const GLYPH = '#00e5ff';

function iconSvg(size) {
  const glyphSize = Math.round(size * 0.52);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, Times New Roman, serif" font-size="${glyphSize}" fill="${GLYPH}">ℵ</text>
</svg>`);
}

function splashSvg(size) {
  const logoSize = Math.round(size * 0.22);
  const logoX = Math.round((size - logoSize) / 2);
  const logoY = Math.round((size - logoSize) / 2);
  const glyphSize = Math.round(logoSize * 0.52);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <text x="${logoX + logoSize / 2}" y="${logoY + logoSize / 2}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, Times New Roman, serif" font-size="${glyphSize}" fill="${GLYPH}">ℵ</text>
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
