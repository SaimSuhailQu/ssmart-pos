import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct a multi-size Windows .ico file containing standard icon sizes (256, 128, 64, 48, 32, 16)
const sizes = [256, 128, 64, 48, 32, 16];
const assetsDir = path.resolve(__dirname, 'assets');

const images = [];
for (const size of sizes) {
  const filePath = path.join(assetsDir, `icon-${size}.png`);
  if (fs.existsSync(filePath)) {
    images.push({
      size,
      buffer: fs.readFileSync(filePath)
    });
  }
}

if (images.length === 0) {
  console.error('No icon PNG files found in', assetsDir);
  process.exit(1);
}

// ICONDIR header: 6 bytes
// 0-1: Reserved (0)
// 2-3: Type (1 for ICO)
// 4-5: Count of images
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

// Each ICONDIRENTRY: 16 bytes
const entries = [];
let offset = 6 + (images.length * 16);

for (const img of images) {
  const entry = Buffer.alloc(16);
  // Width & Height (0 means 256)
  entry.writeUInt8(img.size === 256 ? 0 : img.size, 0);
  entry.writeUInt8(img.size === 256 ? 0 : img.size, 1);
  // Color palette (0)
  entry.writeUInt8(0, 2);
  // Reserved (0)
  entry.writeUInt8(0, 3);
  // Color planes (1)
  entry.writeUInt16LE(1, 4);
  // Bits per pixel (32)
  entry.writeUInt16LE(32, 6);
  // Size of image data in bytes
  entry.writeUInt32LE(img.buffer.length, 8);
  // Offset of image data from beginning of file
  entry.writeUInt32LE(offset, 12);

  entries.push(entry);
  offset += img.buffer.length;
}

const finalIcoBuffer = Buffer.concat([
  header,
  ...entries,
  ...images.map(img => img.buffer)
]);

const outIcoPath = path.join(assetsDir, 'icon.ico');
fs.writeFileSync(outIcoPath, finalIcoBuffer);
console.log(`Created valid Windows ICO file at: ${outIcoPath} (${finalIcoBuffer.length} bytes)`);
