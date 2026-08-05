import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

const svgPath = join(iconsDir, 'logo.svg');

const sizes = [16, 48, 128];

await mkdir(iconsDir, { recursive: true });

for (const size of sizes) {
  const outputPath = join(iconsDir, `icon${size}.png`);
  await sharp(svgPath)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`Generated ${outputPath}`);
}

console.log('Done!');
