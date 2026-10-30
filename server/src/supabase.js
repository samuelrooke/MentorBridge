import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars. Copy server/.env.example to server/.env and fill it in.')
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }

// Bypasses row level security. Use only for trusted admin operations.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, options)

// Acts as the signed-in user, so row level security still applies.
export function supabaseForUser(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...options,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
