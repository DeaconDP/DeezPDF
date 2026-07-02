import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const splashDir = join(root, 'ios/App/App/Assets.xcassets/Splash.imageset');

const BG = '#060810';
const LOGO_SIZE_RATIO = 0.22;

async function writeSplash(path, size) {
  const logoSize = Math.round(size * LOGO_SIZE_RATIO);
  const logo = await sharp(join(publicDir, 'icon-512.png'))
    .resize(logoSize, logoSize, { fit: 'contain', background: BG })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path);

  console.log(`Wrote ${path}`);
}

await mkdir(splashDir, { recursive: true });

const splashSize = 2732;
const splashPath = join(splashDir, 'splash-2732x2732.png');
await writeSplash(splashPath, splashSize);
await writeSplash(join(splashDir, 'splash-2732x2732-1.png'), splashSize);
await writeSplash(join(splashDir, 'splash-2732x2732-2.png'), splashSize);
