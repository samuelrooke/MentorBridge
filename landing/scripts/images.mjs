// Makes the web versions of the site's images. Run it after adding or changing an image:
//   npm run images -w landing
// The results are committed, so the Vercel build doesn't need sharp.
//
// 1. Team photos in public/slides/*.jpg get WebP versions in three widths.
// 2. Slot originals in docs/images-src/<slot id>.(jpg|png|webp) are cropped to the slot's ratio
//    and saved in public/images/ (see scripts/slots.mjs and docs/images.md).
// 3. The logo (public/icon.png, 512 px) gets a small header version and the favicons.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { root } from './pages.mjs'
import { PHOTO_WIDTHS, SLOTS } from './slots.mjs'

const pub = (...parts) => path.join(root, 'public', ...parts)
const srcDir = path.resolve(root, '..', 'docs', 'images-src')
const report = []
const save = async (pipeline, file) => {
  await pipeline.toFile(file)
  report.push(`${path.relative(root, file).replaceAll('\\', '/').padEnd(40)} ${Math.round(fs.statSync(file).size / 1024)} KB`)
}

// 1. Team photos
for (const file of fs.readdirSync(pub('slides')).filter((f) => /^[a-z0-9-]+\.jpg$/.test(f))) {
  const name = file.replace(/\.jpg$/, '')
  for (const width of PHOTO_WIDTHS) {
    await save(sharp(pub('slides', file)).resize(width).webp({ quality: 78 }), pub('slides', `${name}-${width}.webp`))
  }
}

// 2. Slot images
fs.mkdirSync(pub('images'), { recursive: true })
for (const [id, slot] of Object.entries(SLOTS)) {
  const original = ['jpg', 'jpeg', 'png', 'webp'].map((ext) => path.join(srcDir, `${id}.${ext}`)).find((f) => fs.existsSync(f))
  if (!original) {
    report.push(`${id.padEnd(40)} no original in docs/images-src/, skipped`)
    continue
  }
  const [rw, rh] = slot.ratio
  // Warn when the original is too small for the largest export: it gets enlarged and looks soft.
  const meta = await sharp(original).metadata()
  const usable = Math.min(meta.width, Math.round((meta.height * rw) / rh))
  if (usable < slot.widths.at(-1)) report.push(`${id.padEnd(40)} WARNING: original gives ${usable} px at ${rw}:${rh}, smaller than ${slot.widths.at(-1)} px. Use a larger original if you can.`)
  // position: where to crop from. 'attention' looks for the most interesting part; a slot can set 'north' etc.
  const crop = (width) => sharp(original).resize(width, Math.round((width * rh) / rw), { fit: 'cover', position: slot.position ?? 'attention' })
  for (const width of slot.widths) await save(crop(width).webp({ quality: 78 }), pub('images', `${id}-${width}.webp`))
  if (slot.jpg) await save(crop(slot.widths.at(-1)).jpeg({ quality: 80, mozjpeg: true }), pub('images', `${id}.jpg`))
}

// 3. Logo and favicons. The 512 px icon.png stays for structured data and manifests.
await save(sharp(pub('icon.png')).resize(112).png({ palette: true, compressionLevel: 9 }), pub('logo-112.png'))
await save(sharp(pub('icon.png')).resize(32).png({ compressionLevel: 9 }), pub('favicon-32.png'))
// iOS fills transparent corners with black, so the touch icon gets the logo's own background colour.
await save(sharp(pub('icon.png')).flatten({ background: '#4B0211' }).resize(180).png({ compressionLevel: 9 }), pub('apple-touch-icon.png'))

console.log(report.join('\n'))
