// Checks that a development setup is complete: Node version, .env files,
// Supabase connection and migrations, the local API and Docker.
// Run with `npm run doctor`. Exits with 1 if something required is missing.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
let failed = false

const ok = (msg) => console.log(`  ✓ ${msg}`)
const warn = (msg) => console.log(`  ! ${msg}`)
const fail = (msg) => {
  console.log(`  ✗ ${msg}`)
  failed = true
}

function readEnv(app) {
  const file = path.join(root, app, '.env')
  if (!fs.existsSync(file)) return null
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) env[match[1]] = match[2]
  }
  return env
}

const isPlaceholder = (value) => !value || /your-|YOUR-/.test(value)

// 1. Node
console.log('\nNode')
const [major, minor] = process.versions.node.split('.').map(Number)
if (major > 22 || (major === 22 && minor >= 9)) ok(`Node ${process.versions.node}`)
else fail(`Node ${process.versions.node}: needs 22.9 or newer (see .nvmrc)`)

// 2. Environment files
console.log('\nEnvironment files')
const required = {
  client: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  server: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  landing: ['VITE_API_URL'],
}
const envs = {}
for (const [app, keys] of Object.entries(required)) {
  const env = readEnv(app)
  envs[app] = env
  if (!env) {
    fail(`${app}/.env is missing: run \`npm run setup\``)
    continue
  }
  const missing = keys.filter((key) => isPlaceholder(env[key]))
  if (missing.length) fail(`${app}/.env: fill in ${missing.join(', ')}`)
  else ok(`${app}/.env`)
}
if (envs.client && envs.server && envs.client.VITE_SUPABASE_URL !== envs.server.SUPABASE_URL) {
  warn('client and server point at different Supabase projects')
}

// 3. Supabase: reachable, and every migration applied
console.log('\nSupabase')
const server = envs.server
if (server && !isPlaceholder(server.SUPABASE_URL) && !isPlaceholder(server.SUPABASE_SERVICE_ROLE_KEY)) {
  const headers = { apikey: server.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${server.SUPABASE_SERVICE_ROLE_KEY}` }
  // One column introduced by each migration.
  const checks = [
    ['0001_init', 'profiles', 'role'],
    ['0002_pilot_requests', 'pilot_requests', 'interns_per_year'],
    ['0003_pilot_request_roles', 'pilot_requests', 'field'],
    ['0004_student_answers', 'pilot_requests', 'answered_at'],
  ]
  try {
    for (const [migration, table, column] of checks) {
      const res = await fetch(`${server.SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=0`, { headers })
      if (res.ok) ok(`${migration} applied`)
      else fail(`${migration} not applied (${res.status}): run it in the SQL editor, or \`npm run db:push\``)
    }
  } catch (error) {
    fail(`cannot reach ${server.SUPABASE_URL}: ${error.message}`)
  }
} else {
  warn('skipped: server/.env has no Supabase URL and secret key yet')
}

// 4. Local API (optional)
console.log('\nAPI')
try {
  const res = await fetch('http://localhost:4000/api/health', { signal: AbortSignal.timeout(2000) })
  if (res.ok) ok('API running on http://localhost:4000')
  else warn(`API answered with ${res.status}`)
} catch {
  warn('API not running (start it with `npm run dev` or `npm run docker:up`)')
}

// 5. Docker (optional, needed for docker:up and the local Supabase stack)
console.log('\nDocker')
try {
  const version = execSync('docker info --format "{{.ServerVersion}}"', { stdio: ['ignore', 'pipe', 'ignore'] })
  ok(`Docker ${version.toString().trim()} running`)
} catch {
  warn('Docker not running (only needed for `npm run docker:up` and `npm run db:start`)')
}

console.log(failed ? '\nSome required checks failed. Fix the ✗ items above.\n' : '\nAll required checks passed.\n')
process.exit(failed ? 1 : 0)
