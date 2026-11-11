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

export const root = path.resolve(import.meta.dirname, '..')
export const partialsDir = path.join(root, 'partials')

export const SITE_URL = 'https://mentorbridge.nl'

export const PAGES = [
  { name: 'home', file: 'index.html', path: '/', segment: '', cta: '/#choose' },
  { name: 'students', file: 'students/index.html', path: '/students/', segment: 'student', cta: '#signup' },
  { name: 'mentors', file: 'mentors/index.html', path: '/mentors/', segment: 'mentor', cta: '#signup' },
  { name: 'companies', file: 'companies/index.html', path: '/companies/', segment: 'company', cta: '#signup' },
  { name: 'privacy', file: 'privacy/index.html', path: '/privacy/', segment: '', cta: '/#choose' },
]

// Finds the page for a file path or URL like /students/index.html or /students/.
export function pageFor(url) {
  const clean = url.split('?')[0].replace(/index\.html$/, '')
  return PAGES.find((page) => page.path === clean)
}

export function compose(html, page) {
  const filled = html
    .replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name) =>
      fs.readFileSync(path.join(partialsDir, `${name}.html`), 'utf8').trim(),
    )
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
