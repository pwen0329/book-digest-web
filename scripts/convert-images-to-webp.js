#!/usr/bin/env node
/**
 * Convert all JPG/PNG book cover images to WebP format.
 * Also resizes oversized images to max 600px width.
 * Updates data/books.json references from old extensions to .webp.
 *
 * Usage: node scripts/convert-images-to-webp.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIRS = [
  'public/images/books_zh',
  'public/images/books_en',
];
const MAX_WIDTH = 600;
const QUALITY = 82;

async function convertFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.webp') return null; // already webp

  const webpPath = filePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  
  try {
    const metadata = await sharp(filePath).metadata();
    let pipeline = sharp(filePath);
    
    // Resize if wider than MAX_WIDTH
    if (metadata.width && metadata.width > MAX_WIDTH) {
      pipeline = pipeline.resize(MAX_WIDTH, null, { withoutEnlargement: true });
    }
    
    await pipeline.webp({ quality: QUALITY }).toFile(webpPath);
    
    const oldSize = fs.statSync(filePath).size;
    const newSize = fs.statSync(webpPath).size;
    const savings = ((1 - newSize / oldSize) * 100).toFixed(1);
    
    // Delete original
    fs.unlinkSync(filePath);
    
    console.log(`✓ ${path.basename(filePath)} → .webp (${savings}% smaller)`);
    return { old: filePath, new: webpPath, savings };
  } catch (err) {
    console.error(`✗ Failed: ${filePath}`, err.message);
    return null;
  }
}

async function main() {
  let totalConverted = 0;
  let totalSavedBytes = 0;

  for (const dir of DIRS) {
    const fullDir = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullDir)) continue;
    
    const files = fs.readdirSync(fullDir)
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
      .map(f => path.join(fullDir, f));

    console.log(`\n📁 ${dir}: ${files.length} files to convert`);
    
    for (const file of files) {
      const oldSize = fs.statSync(file).size;
      const result = await convertFile(file);
      if (result) {
        totalConverted++;
        totalSavedBytes += oldSize - fs.statSync(result.new).size;
      }
    }
  }

  // Update books.json references
  const booksPath = path.join(process.cwd(), 'data/books.json');
  let booksJson = fs.readFileSync(booksPath, 'utf-8');
  const before = booksJson;
  booksJson = booksJson.replace(/\.(jpg|jpeg|png)"/gi, '.webp"');
  
  if (booksJson !== before) {
    fs.writeFileSync(booksPath, booksJson, 'utf-8');
    console.log('\n✓ Updated data/books.json image references to .webp');
  }

  // Also convert elements directory images
  const elemDir = path.join(process.cwd(), 'public/images/elements');
  if (fs.existsSync(elemDir)) {
    const elemFiles = fs.readdirSync(elemDir)
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
      .map(f => path.join(elemDir, f));
    
    if (elemFiles.length > 0) {
      console.log(`\n📁 public/images/elements: ${elemFiles.length} files to convert`);
      for (const file of elemFiles) {
        await convertFile(file);
        totalConverted++;
      }
    }
  }

  console.log(`\n✅ Done! Converted ${totalConverted} images. Saved ~${(totalSavedBytes / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error);
