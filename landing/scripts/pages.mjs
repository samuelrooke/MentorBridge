// The landing pages and the shared parts (partials) they are built from.
//
// Each page is a normal HTML file. Shared parts are pulled in with a comment:
//   <!-- @include header -->   inserts partials/header.html
// and these placeholders are filled in per page:
//   {{site}}         the production address, https://mentorbridge.nl (also on preview deployments)
//   {{path}}         the page's address, e.g. /students/
//   {{segment}}      student, mentor or company (empty on pages without a sign-up form)
//   {{cta}}          where the header button goes
//   {{title}}        the page's <title>, reused for Open Graph
//   {{description}}  the page's meta description, reused for Open Graph
// Vite does this for the English pages (vite.config.js), build-nl.mjs for the Dutch ones.
import fs from 'node:fs'
import path from 'node:path'
import { PHOTO_WIDTHS, SLOTS } from './slots.mjs'

export const root = path.resolve(import.meta.dirname, '..')
export const partialsDir = path.join(root, 'partials')

export const SITE_URL = 'https://mentorbridge.nl'

export const PAGES = [
  { name: 'home', file: 'index.html', path: '/', segment: '', cta: '/login?mode=signup' },
  { name: 'students', file: 'students/index.html', path: '/students/', segment: 'student', cta: '#signup' },
  { name: 'mentors', file: 'mentors/index.html', path: '/mentors/', segment: 'mentor', cta: '#signup' },
  { name: 'companies', file: 'companies/index.html', path: '/companies/', segment: 'company', cta: '#signup' },
  { name: 'privacy', file: 'privacy/index.html', path: '/privacy/', segment: '', cta: '/login?mode=signup' },
]

// Finds the page for a file path or URL like /students/index.html or /students/.
export function pageFor(url) {
  const clean = url.split('?')[0].replace(/index\.html$/, '')
  return PAGES.find((page) => page.path === clean)
}

// <!-- @image id --> becomes the slot's own image, its fallback team photo, or a placeholder box.
// See scripts/slots.mjs.
function image(id) {
  const slot = SLOTS[id]
  if (!slot) throw new Error(`Unknown image slot "${id}" (see scripts/slots.mjs)`)
  const [rw, rh] = slot.ratio
  const exists = (file) => fs.existsSync(path.join(root, 'public', file))
  let base, widths, alt, src
  if (slot.widths.every((w) => exists(`images/${id}-${w}.webp`))) {
    ;[base, widths, alt] = [`/images/${id}`, slot.widths, slot.alt]
    src = slot.jpg && exists(`images/${id}.jpg`) ? `${base}.jpg` : `${base}-${widths.at(-1)}.webp`
  } else if (slot.fallback) {
    ;[base, widths, alt] = [`/slides/${slot.fallback.photo}`, PHOTO_WIDTHS, slot.fallback.alt]
    src = `${base}.jpg`
  } else {
    return `<div class="${slot.className} img-slot" style="aspect-ratio: ${rw} / ${rh}" data-slot="${id}" aria-hidden="true"></div>`
  }
  const width = widths.at(-1)
  const height = Math.round((width * rh) / rw)
  const srcset = widths.map((w) => `${base}-${w}.webp ${w}w`).join(', ')
  const loading = slot.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'
  return `<picture class="${slot.className}" data-slot="${id}"><source type="image/webp" srcset="${srcset}" sizes="${slot.sizes}" /><img src="${src}" alt="${alt.replaceAll('"', '&quot;')}" width="${width}" height="${height}" ${loading} decoding="async" /></picture>`
}

export function compose(html, page) {
  const filled = html
    .replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name) =>
      fs.readFileSync(path.join(partialsDir, `${name}.html`), 'utf8').trim(),
    )
    .replace(/<!--\s*@image\s+([\w-]+)\s*-->/g, (_, id) => image(id))
    .replaceAll('{{site}}', SITE_URL)
    .replaceAll('{{path}}', page.path)
    .replaceAll('{{segment}}', page.segment)
    .replaceAll('{{cta}}', page.cta)
    .replaceAll(`data-nav="${page.path}"`, `data-nav="${page.path}" aria-current="page"`)

  // Open Graph reuses the page's own title and description, so each text is written (and translated) once.
  const title = filled.match(/<title>([\s\S]*?)<\/title>/)?.[1].trim() ?? ''
  const description = filled.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] ?? ''
  return filled.replaceAll('{{title}}', title.replaceAll('"', '&quot;')).replaceAll('{{description}}', description)
}
