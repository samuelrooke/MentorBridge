import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { PAGES, compose, pageFor, partialsDir } from './scripts/pages.mjs'

// Fills in the shared parts (partials/*.html) of the English pages, in dev and in the build.
// The Dutch pages in nl/ are generated already complete by scripts/build-nl.mjs.
function partials() {
  return {
    name: 'mentorbridge-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = pageFor(ctx.path)
        return page ? compose(html, page) : html
      },
    },
    configureServer(server) {
      // Reload the browser when a partial changes.
      server.watcher.add(partialsDir)
      server.watcher.on('change', (file) => {
        if (resolve(file).startsWith(partialsDir)) server.ws.send({ type: 'full-reload' })
      })
    },
  }
}

export default defineConfig({
  // Separate pages, not a single-page app: unknown URLs give a 404 locally too, like on Vercel.
  appType: 'mpa',
  plugins: [tailwindcss(), partials()],
  build: {
    // Every page in English (/students/) and Dutch (/nl/students/).
    rollupOptions: {
      input: Object.fromEntries(
        PAGES.flatMap((page) => [
          [page.name, resolve(import.meta.dirname, page.file)],
          [`nl-${page.name}`, resolve(import.meta.dirname, 'nl', page.file)],
        ]),
      ),
    },
  },
})
