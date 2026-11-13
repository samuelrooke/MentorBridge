import type { Role } from './supabase'

export type MatchStatus = 'proposed' | 'active' | 'completed' | 'cancelled'
export const MATCH_STATUSES: MatchStatus[] = ['proposed', 'active', 'completed', 'cancelled']

export type AdminUser = {
  id: string
  email: string | null
  confirmed: boolean
  created_at: string
  last_sign_in_at: string | null
  role: Role | null
  full_name: string | null
  bio: string | null
  answers: Record<string, unknown> | null
  match_count: number
}

export type AdminMatch = {
  id: string
  student_id: string
  mentor_id: string
  company_id: string | null
  status: MatchStatus
  created_at: string
  student_name: string
  mentor_name: string
  company_name: string | null
  session_count: number
  next_session_at: string | null
  message_count: number
  last_message_at: string | null
}

export type Suggestion = { student_id: string; mentor_id: string; keywords: string[]; student_name: string; mentor_name: string }

export type Person = { id: string; full_name: string | null; email: string | null }
export type Candidates = { students: Person[]; mentors: Person[]; companies: Person[] }

export type WaitlistEntry = Record<string, unknown> & { id: string; role: string; email: string; name: string | null; created_at: string }
export type Report = {
  id: string
  reporter_id: string
  reported_user_id: string | null
  match_id: string | null
  message_id: string | null
  message_snapshot: string | null
  message_had_picture: boolean
  reason: 'harassment' | 'inappropriate' | 'spam' | 'safety' | 'other'
  details: string | null
  status: 'open' | 'resolved'
  admin_note: string | null
  resolved_at: string | null
  created_at: string
  reporter_name: string | null
  reporter_role: string | null
  reported_name: string | null
  reported_role: string | null
  match_label: string | null
}

export type ContactMessage = { id: string; name: string | null; email: string; message: string; created_at: string }

export type Overview = {
  accounts: { total: number; byRole: Record<Role, number>; unconfirmed: number; newLast7Days: number }
  matches: { total: number; byStatus: Record<MatchStatus, number>; studentsWithoutMatch: number; mentorsWithoutMatch: number }
  sessions: { total: number; upcoming: number; next7Days: number }
  messages: { total: number; last7Days: number }
  waitlist: {
    total: number
    byRole: Record<'student' | 'mentor' | 'company', number>
    last7Days: number
    bySource: { source: string; total: number }[]
    targets: { role: 'student' | 'mentor' | 'company'; signups: number; target: number }[]
  }
  contact: { total: number }
  reports: { open: number }
  reviews: { total: number; average: number | null; notTookPlace: number }
  recent: { type: 'account' | 'waitlist' | 'contact'; at: string; label: string; detail: string }[]
  upcomingMatches: AdminMatch[]
}

// Spreadsheet apps run cells that start with these as formulas. Visitors type the names
// on the waiting list, so prefix them with an apostrophe to keep them plain text.
const FORMULA_START = /^[=+\-@\t\r]/

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ''
  let text = Array.isArray(value) ? value.join('; ') : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV with a header row, in the given column order. Opens cleanly in Excel and Google Sheets. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\r\n') + '\r\n'
}

export function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8') {
  // The byte order mark makes Excel read accented names correctly.
  const blob = new Blob(['﻿', content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '–'
  return new Intl.DateTimeFormat(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value))
}

/** Case-insensitive search across a few text fields. */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]) {
  const wanted = query.trim().toLocaleLowerCase()
  return !wanted || fields.some((field) => field?.toLocaleLowerCase().includes(wanted))
}
