const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function createBmpBuffer(width, height, rawBgrBuffer) {
  const bytesPerPixel = 3;
  const rowSize = Math.floor((width * bytesPerPixel + 3) / 4) * 4;
  const paddingSize = rowSize - width * bytesPerPixel;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;

  const header = Buffer.alloc(54);
  // Bitmap File Header
  header.write('BM', 0, 2, 'ascii');
  header.writeUInt32LE(fileSize, 2);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt32LE(54, 10); // data offset

  // DIB Header (BITMAPINFOHEADER - 40 bytes)
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22); // positive = bottom-up
  header.writeUInt16LE(1, 26); // color planes
  header.writeUInt16LE(24, 28); // 24 bpp
  header.writeUInt32LE(0, 30); // BI_RGB (uncompressed)
  header.writeUInt32LE(imageSize, 34);
  header.writeInt32LE(2835, 38); // ~72 DPI
  header.writeInt32LE(2835, 42);
  header.writeUInt32LE(0, 46);
  header.writeUInt32LE(0, 50);

  const pixelData = Buffer.alloc(imageSize);
  // BMP standard is bottom-up: row 0 is the bottom row
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    const srcOffset = srcY * width * 3;
    const destOffset = y * rowSize;
    for (let x = 0; x < width; x++) {
      const srcPx = srcOffset + x * 3;
      const destPx = destOffset + x * 3;
      // rawBgrBuffer has BGR
      pixelData[destPx] = rawBgrBuffer[srcPx];         // B
      pixelData[destPx + 1] = rawBgrBuffer[srcPx + 1]; // G
      pixelData[destPx + 2] = rawBgrBuffer[srcPx + 2]; // R
    }
    // Padding bytes are already 0
  }

  return Buffer.concat([header, pixelData]);
}

async function convertImageToBmp(srcPath, destPaths, width, height) {
  // Resize and composite over dark background (#0E1015) in case of transparency
  const { data, info } = await sharp(srcPath)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .flatten({ background: { r: 14, g: 16, b: 21 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // sharp raw() returns RGB, convert to BGR for standard BMP
  const bgr = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 3) {
    bgr[i] = data[i + 2];     // B
    bgr[i + 1] = data[i + 1]; // G
    bgr[i + 2] = data[i];     // R
  }

  const bmpBuffer = createBmpBuffer(width, height, bgr);
  for (const destPath of destPaths) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, bmpBuffer);
    console.log(`Generated ${destPath} (${bmpBuffer.length} bytes, ${width}x${height}, 24-bit BMP)`);
  }
}

async function main() {
  const sidebarSrc = path.resolve(__dirname, '../src/assets/NSIS_Sidebar.png');
  const headerSrc = path.resolve(__dirname, '../src/assets/NSIS_Header.png');

  await convertImageToBmp(sidebarSrc, [
    path.resolve(__dirname, '../assets/installerSidebar.bmp'),
    path.resolve(__dirname, '../build/installerSidebar.bmp')
  ], 164, 314);

  await convertImageToBmp(headerSrc, [
    path.resolve(__dirname, '../assets/installerHeader.bmp'),
    path.resolve(__dirname, '../build/installerHeader.bmp')
  ], 150, 57);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
