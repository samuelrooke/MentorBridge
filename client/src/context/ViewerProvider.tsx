import { useEffect, useState, type ReactNode } from 'react'
import { supabase, type Profile } from '../lib/supabase'
import { useAuth } from './auth'
import { ViewerContext, type ViewerState } from './viewer'

const STORAGE_KEY = 'mentorbridge:view-as'

function readStoredId() {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private windows can block storage; view-as then just isn't remembered on reload.
  }
}

export function ViewerProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [viewingAs, setViewingAsState] = useState<Profile | null>(null)

  // Restore "view as" after a reload in the same tab (admins only).
  useEffect(() => {
    const storedId = readStoredId()
    if (!isAdmin || !storedId) return
    let active = true
    void supabase.from('profiles').select('*').eq('id', storedId).maybeSingle()
      .then(({ data }) => { if (active && data && data.role !== 'admin') setViewingAsState(data as Profile) })
    return () => { active = false }
  }, [isAdmin])

  function setViewingAs(next: Profile | null) {
    const target = next && next.role !== 'admin' ? next : null
    storeId(target?.id ?? null)
    setViewingAsState(target)
  }

  // Only an admin can view as someone; for everyone else this is always off.
  const activeViewingAs = isAdmin ? viewingAs : null
  const value: ViewerState = {
    viewer: activeViewingAs ?? profile,
    actorId: profile?.id,
    isAdmin,
    viewingAs: activeViewingAs,
    setViewingAs,
  }
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
}
