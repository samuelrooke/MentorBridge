import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing Supabase env vars. Copy client/.env.example to client/.env and fill it in.')
}

export const supabase = createClient(url, anonKey)

export type Role = 'student' | 'company' | 'mentor' | 'admin'

export type Profile = {
  id: string
  role: Role
  full_name: string | null
  email: string | null
  created_at: string
}
