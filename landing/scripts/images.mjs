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
import { PHOTO_WIDTHS, SLIDE_CROPS, SLOTS } from './slots.mjs'

const pub = (...parts) => path.join(root, 'public', ...parts)
const srcDir = path.resolve(root, '..', 'docs', 'images-src')
const report = []
const save = async (pipeline, file) => {
  await pipeline.toFile(file)
  report.push(`${path.relative(root, file).replaceAll('\\', '/').padEnd(40)} ${Math.round(fs.statSync(file).size / 1024)} KB`)
}

// 0. Slideshow photos: crop the originals to 4:3 JPGs in public/slides/ (step 1 then makes the WebP versions).
for (const [name, position] of Object.entries(SLIDE_CROPS)) {
  const original = path.join(srcDir, 'slides', `${name}.jpg`)
  if (!fs.existsSync(original)) {
    report.push(`${name.padEnd(40)} no original in docs/images-src/slides/, skipped`)
    continue
  }
  // Zoomed out: the whole photo fits the 4:3 frame. The empty sides show a blurred, darkened copy of
  // the same photo, so nothing is cut off. Any other position ('cover', 'attention', 'north'...) crops instead, for large or landscape photos.
  // { top: 0.3 }: crop a 4:3 band of the full width, starting at that fraction of the height (for tall photos).
  if (typeof position === 'object') {
    const { width, height } = await sharp(original).metadata()
    const h = Math.round((width * 3) / 4)
    await save(sharp(original).extract({ left: 0, top: Math.min(Math.round(height * position.top), height - h), width, height: h }).resize(1440, 1080).jpeg({ quality: 82, mozjpeg: true }), pub('slides', `${name}.jpg`))
    continue
  }
  if (position !== 'contain') {
    await save(sharp(original).resize(1440, 1080, { fit: 'cover', position: position === 'cover' ? 'centre' : position }).jpeg({ quality: 82, mozjpeg: true }), pub('slides', `${name}.jpg`))
    continue
  }
  const backdrop = await sharp(original).resize(1440, 1080, { fit: 'cover' }).blur(40).modulate({ brightness: 0.7 }).toBuffer()
  const photo = await sharp(original).resize(1440, 1080, { fit: 'inside' }).toBuffer()
  await save(sharp(backdrop).composite([{ input: photo, gravity: 'centre' }]).jpeg({ quality: 82, mozjpeg: true }), pub('slides', `${name}.jpg`))
}

// 1. Photos in public/slides
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
