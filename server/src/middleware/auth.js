import { supabaseAdmin, supabaseForUser } from '../supabase.js'

// Verifies the Supabase access token sent as "Authorization: Bearer <token>"
// and attaches req.user, req.profile and a user-scoped req.supabase client.
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  if (!token) return res.status(401).json({ error: 'Missing access token' })

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired token' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  req.user = data.user
  req.profile = profile
  req.supabase = supabaseForUser(token)
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile || !roles.includes(req.profile.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
