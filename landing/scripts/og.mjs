// Renders the link preview images public/og/og-en.jpg and og-nl.jpg (1200 x 627, under 300 KB)
// from og-template/og.html with headless Chrome, then compresses them with sharp:
//   npm run og -w landing
// Background photo: docs/images-src/og-background.(jpg|png|webp) if it exists, otherwise the team photo match.jpg.
// Chrome is looked up in the usual places; set CHROME_PATH if it lives somewhere else.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { root } from './pages.mjs'

const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && fs.existsSync(p))
if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH to your Chrome or Edge executable.')

const srcDir = path.resolve(root, '..', 'docs', 'images-src')
const background = ['jpg', 'jpeg', 'png', 'webp'].map((ext) => `og-background.${ext}`).find((f) => fs.existsSync(path.join(srcDir, f)))
const photo = background ? `/images-src/${background}` : '/slides/match-1440.webp'

// A tiny static server: the template, public/ (fonts, logo, photos) and docs/images-src/.
const types = { '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  const file = pathname.startsWith('/og-template/')
    ? path.join(root, pathname)
    : pathname.startsWith('/images-src/')
      ? path.join(srcDir, pathname.slice('/images-src/'.length))
      : path.join(root, 'public', pathname)
  if (!file.startsWith(path.resolve(root, '..')) || !fs.existsSync(file)) return res.writeHead(404).end()
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-og-'))
fs.mkdirSync(path.join(root, 'public', 'og'), { recursive: true })
try {
  for (const lang of ['en', 'nl']) {
    const png = path.join(profile, `og-${lang}.png`)
    const url = `http://127.0.0.1:${port}/og-template/og.html?lang=${lang}&photo=${encodeURIComponent(photo)}`
    await promisify(execFile)(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${profile}`, '--window-size=1200,627', '--virtual-time-budget=5000', `--screenshot=${png}`, url])
    const out = path.join(root, 'public', 'og', `og-${lang}.jpg`)
    await sharp(png).resize(1200, 627, { fit: 'cover' }).jpeg({ quality: 84, mozjpeg: true }).toFile(out)
    const kb = Math.round(fs.statSync(out).size / 1024)
    console.log(`public/og/og-${lang}.jpg  1200x627  ${kb} KB${kb > 300 ? '  TOO BIG (max 300 KB)' : ''}  photo: ${photo}`)
  }
} finally {
  server.close()
  fs.rmSync(profile, { recursive: true, force: true })
}
