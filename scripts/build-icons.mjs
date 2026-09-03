import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'assets', 'logo.svg');
const buildDir = path.join(root, 'build');
const srcAssetDir = path.join(root, 'src', 'assets');
const svg = await readFile(source);

await mkdir(buildDir, { recursive: true });
await mkdir(srcAssetDir, { recursive: true });

const pngSizes = [16, 24, 32, 48, 64, 128, 256];
const pngPaths = [];

for (const size of pngSizes) {
  const target = path.join(buildDir, `icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(target);
  pngPaths.push(target);
}

await sharp(svg).resize(64, 64).png().toFile(path.join(srcAssetDir, 'logo.png'));
await sharp(svg).resize(256, 256).png().toFile(path.join(buildDir, 'icon.png'));

const ico = await pngToIco(pngPaths);
await writeFile(path.join(buildDir, 'icon.ico'), ico);

console.log('Generated logo assets in build/ and src/assets/.');
