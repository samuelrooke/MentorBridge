import { createContext, useContext } from 'react'
import type { Profile } from '../lib/supabase'

// Whose eyes the app is showing. Normally that's the logged-in user. An admin can
// "view as" a student, mentor or company: pages then show that person's matches,
// sessions and messages, while every change is still made by the admin's own account
// (messages are posted as "MentorBridge team", never in the other person's name).
export type ViewerState = {
  /** The profile the pages show. The admin's own profile when not viewing as someone. */
  viewer: Profile | null
  /** The logged-in account. Use this for every write. */
  actorId: string | undefined
  /** The logged-in account is an admin. */
  isAdmin: boolean
  /** Set when an admin is viewing the platform as someone else. */
  viewingAs: Profile | null
  setViewingAs: (profile: Profile | null) => void
}

export const ViewerContext = createContext<ViewerState | null>(null)

export function useViewer() {
  const ctx = useContext(ViewerContext)
  if (!ctx) throw new Error('useViewer must be used inside <ViewerProvider>')
  return ctx
}

/** Admin looking at all matches, not viewing as anyone. */
export function isAdminView(state: Pick<ViewerState, 'viewer'>) {
  return state.viewer?.role === 'admin'
}
