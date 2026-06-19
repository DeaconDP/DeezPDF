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
const ACCENT_SECONDARY = '#c4007a';

function iconSvg(size) {
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  const rx = Math.round(size * 0.08);
  const fontSize = Math.round(size * 0.34);
  const labelY = Math.round(size * 0.72);
  const docW = Math.round(inner * 0.42);
  const docH = Math.round(inner * 0.52);
  const docX = Math.round((size - docW) / 2);
  const docY = Math.round(size * 0.18);
  const fold = Math.round(docW * 0.28);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BG}"/>
  <rect x="${docX}" y="${docY}" width="${docW}" height="${docH}" rx="${Math.max(2, Math.round(size * 0.02))}" fill="none" stroke="${ACCENT}" stroke-width="${Math.max(2, Math.round(size * 0.018))}"/>
  <path d="M${docX + docW - fold} ${docY} L${docX + docW} ${docY + fold} L${docX + docW - fold} ${docY + fold} Z" fill="${ACCENT_SECONDARY}" opacity="0.9"/>
  <line x1="${docX + Math.round(docW * 0.18)}" y1="${docY + Math.round(docH * 0.35)}" x2="${docX + docW - Math.round(docW * 0.18)}" y2="${docY + Math.round(docH * 0.35)}" stroke="${ACCENT}" stroke-width="${Math.max(2, Math.round(size * 0.012))}" opacity="0.85"/>
  <line x1="${docX + Math.round(docW * 0.18)}" y1="${docY + Math.round(docH * 0.52)}" x2="${docX + docW - Math.round(docW * 0.18)}" y2="${docY + Math.round(docH * 0.52)}" stroke="${ACCENT}" stroke-width="${Math.max(2, Math.round(size * 0.012))}" opacity="0.65"/>
  <line x1="${docX + Math.round(docW * 0.18)}" y1="${docY + Math.round(docH * 0.69)}" x2="${docX + docW - Math.round(docW * 0.34)}" y2="${docY + Math.round(docH * 0.69)}" stroke="${ACCENT}" stroke-width="${Math.max(2, Math.round(size * 0.012))}" opacity="0.45"/>
  <text x="${size / 2}" y="${labelY}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="${ACCENT}">PDF</text>
</svg>`);
}

function splashSvg(size) {
  const logoSize = Math.round(size * 0.22);
  const logoX = Math.round((size - logoSize) / 2);
  const logoY = Math.round((size - logoSize) / 2);
  const inner = logoSize;
  const docW = Math.round(inner * 0.42);
  const docH = Math.round(inner * 0.52);
  const docX = logoX + Math.round((inner - docW) / 2);
  const docY = logoY + Math.round(inner * 0.18);
  const fold = Math.round(docW * 0.28);
  const fontSize = Math.round(inner * 0.34);
  const labelY = logoY + Math.round(inner * 0.72);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <rect x="${docX}" y="${docY}" width="${docW}" height="${docH}" rx="${Math.max(2, Math.round(inner * 0.02))}" fill="none" stroke="${ACCENT}" stroke-width="${Math.max(2, Math.round(inner * 0.018))}"/>
  <path d="M${docX + docW - fold} ${docY} L${docX + docW} ${docY + fold} L${docX + docW - fold} ${docY + fold} Z" fill="${ACCENT_SECONDARY}" opacity="0.9"/>
  <line x1="${docX + Math.round(docW * 0.18)}" y1="${docY + Math.round(docH * 0.35)}" x2="${docX + docW - Math.round(docW * 0.18)}" y2="${docY + Math.round(docH * 0.35)}" stroke="${ACCENT}" stroke-width="${Math.max(2, Math.round(inner * 0.012))}" opacity="0.85"/>
  <line x1="${docX + Math.round(docW * 0.18)}" y1="${docY + Math.round(docH * 0.52)}" x2="${docX + docW - Math.round(docW * 0.18)}" y2="${docY + Math.round(docH * 0.52)}" stroke="${ACCENT}" stroke-width="${Math.max(2, Math.round(inner * 0.012))}" opacity="0.65"/>
  <text x="${logoX + inner / 2}" y="${labelY}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="${ACCENT}">PDF</text>
</svg>`);
}

async function writePng(path, svgBuffer) {
  await sharp(svgBuffer).png().toFile(path);
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
