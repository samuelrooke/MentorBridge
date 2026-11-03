import { supabase } from './supabase'

// In development Vite forwards /api to the local server. In production set
// VITE_API_URL to the API's public URL (it runs on its own domain).
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// Calls the Node backend with the current user's access token.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}
