/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The app is served on mentorbridge.nl next to the landing pages (landing/vercel.json
  // forwards the app's paths here). Its own folder keeps its files apart from the landing's /assets/.
  build: { assetsDir: 'app-assets' },
  server: {
    // Forward /api calls to the Node backend during development.
    proxy: { '/api': 'http://localhost:4000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Tests never talk to the real Supabase project.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
