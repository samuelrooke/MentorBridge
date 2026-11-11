// Writes public/sitemap.xml from the page list in pages.mjs: every page in English and Dutch,
// each with its hreflang alternates. Runs before `dev` and `build`, so it can't drift when pages are added.
// The file is generated, so it isn't in git.
import fs from 'node:fs'
import path from 'node:path'
import { PAGES, SITE_URL, root } from './pages.mjs'

const alternates = (page) =>
  [
    ['en', page.path],
    ['nl', `/nl${page.path}`],
    ['x-default', page.path],
  ]
    .map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE_URL}${href}"/>`)
    .join('\n')

const urls = PAGES.flatMap((page) => [page.path, `/nl${page.path}`].map((loc) => `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n${alternates(page)}\n  </url>`))

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`
fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), xml)
console.log(`public/sitemap.xml written (${urls.length} URLs).`)
