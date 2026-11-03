// First-time setup for a new teammate.
//
//   npm run setup         Creates client/.env, server/.env and landing/.env from the
//                         .env.example files (existing files are never overwritten).
//   npm run setup:local   Same, then points client and server at the LOCAL Supabase
//                         stack (run `npm run db:start` first). Existing .env files
//                         are backed up to .env.bak first.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const apps = ['client', 'server', 'landing']
const useLocal = process.argv.includes('--local')

for (const app of apps) {
  const example = path.join(root, app, '.env.example')
  const target = path.join(root, app, '.env')
  if (fs.existsSync(target)) {
    console.log(`  kept     ${app}/.env (already exists)`)
  } else {
    fs.copyFileSync(example, target)
    console.log(`  created  ${app}/.env from .env.example`)
  }
}

if (useLocal) {
  let status
  try {
    status = JSON.parse(execSync('npx supabase status -o json', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString())
  } catch {
    console.error('\nLocal Supabase is not running. Start Docker Desktop, then run `npm run db:start`.')
    process.exit(1)
  }
  const url = status.API_URL
  const anonKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY
  const serviceKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY

  setValues('client', { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anonKey })
  setValues('server', { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey })
  console.log(`\nClient and server now use local Supabase at ${url}.`)
  console.log('Studio (database UI): http://127.0.0.1:54323 · test emails: http://127.0.0.1:54324')
  console.log('To go back to the shared project, restore client/.env.bak and server/.env.bak.')
}

console.log('\nNext: fill in any placeholder values, then run `npm run doctor`.')

// Replaces (or adds) KEY=value lines in an app's .env, after backing the file up once.
function setValues(app, values) {
  const file = path.join(root, app, '.env')
  const backup = `${file}.bak`
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup)

  let text = fs.readFileSync(file, 'utf8')
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`
    const pattern = new RegExp(`^${key}=.*$`, 'm')
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`
  }
  fs.writeFileSync(file, text)
  console.log(`  updated  ${app}/.env (backup in ${app}/.env.bak)`)
}
