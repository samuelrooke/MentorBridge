// Writes public/sitemap.xml from the page list in pages.mjs: every page in English and Dutch,
// each with its hreflang alternates. Runs before `dev` and `build`, so it can't drift when pages are added.
// The file is generated, so it isn't in git.
//
// <lastmod> is the date of the last commit that changed what the page is built from: the page
// itself, the shared partials, and for Dutch pages also i18n/nl.json. Search engines only trust
// lastmod when it is accurate, so it is left out when git history isn't available (for example
// in a shallow clone), instead of guessing. No <priority> or <changefreq>: Google ignores both.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { PAGES, SITE_URL, root } from './pages.mjs'

function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const fullHistory = git(['rev-parse', '--is-shallow-repository']) === 'false'

// Last commit date (YYYY-MM-DD) touching any of these paths, or '' if unknown.
function lastCommitDate(paths) {
  if (!fullHistory) return ''
  return git(['log', '-1', '--format=%cs', '--', ...paths])
}

const alternates = (page) =>
  [
    ['en', page.path],
    ['nl', `/nl${page.path}`],
    ['x-default', page.path],
  ]
    .map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE_URL}${href}"/>`)
    .join('\n')

const entry = (loc, page, lastmod) =>
  [
    '  <url>',
    `    <loc>${SITE_URL}${loc}</loc>`,
    ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
    alternates(page),
    '  </url>',
  ].join('\n')

const urls = PAGES.flatMap((page) => {
  const sources = [page.file, 'partials']
  return [
    entry(page.path, page, lastCommitDate(sources)),
    entry(`/nl${page.path}`, page, lastCommitDate([...sources, 'i18n/nl.json'])),
  ]
})

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`
fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), xml)
console.log(`public/sitemap.xml written (${urls.length} URLs${fullHistory ? ', with lastmod' : ', no lastmod: git history not available'}).`)
