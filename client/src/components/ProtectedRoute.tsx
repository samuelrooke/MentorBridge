import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../lib/supabase'

export default function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="centered muted">Loading…</p>
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return children
}
