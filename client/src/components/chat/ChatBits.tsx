import { useEffect, useRef, useState, type FormEvent } from 'react'
import { friendlyError } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Avatar: profile photo, or the first letter of the name. The team gets an "M".
// ---------------------------------------------------------------------------
export function Avatar({ name, url, team = false, online = false, size = 'md' }: {
  name: string
  url?: string
  team?: boolean
  online?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span className={`chat-avatar chat-avatar-${size}${team ? ' chat-avatar-team' : ''}`} aria-hidden="true">
      {url ? <img src={url} alt="" /> : <span>{team ? 'M' : (name.trim()[0] ?? '?').toUpperCase()}</span>}
      {online && <span className="online-dot" />}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Dialog shell: closes on Escape and on a click outside, keeps focus inside.
// ---------------------------------------------------------------------------
function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button, textarea, input, a')?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [onClose])
  return ref
}

export function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const ref = useDialog(onClose)
  return (
    <div className="dialog-backdrop lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={alt} className="lightbox-inner">
        <img src={url} alt={alt} />
        <div className="lightbox-actions">
          <a className="btn btn-sm btn-on-dark" href={url} target="_blank" rel="noreferrer">Open original</a>
          <button className="btn btn-sm btn-on-dark" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report a message or a person. The database fills in who wrote the message and a
// copy of it, so a report can't be faked.
// ---------------------------------------------------------------------------
const REASONS = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate or offensive content' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'safety', label: 'I feel unsafe' },
  { value: 'other', label: 'Something else' },
]

export type ReportTarget = { matchId: string; personId: string; personName: string; messageId?: string; messageText?: string }

export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const ref = useDialog(onClose)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!reason) return setError('Choose what happened.')
    setSending(true)
    setError(null)
    const { error: insertError } = await supabase.from('reports').insert({
      match_id: target.matchId,
      message_id: target.messageId ?? null,
      reported_user_id: target.messageId ? null : target.personId,
      reason,
      details: details.trim() || null,
    })
    setSending(false)
    if (insertError) setError(friendlyError(insertError))
    else setDone(true)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={ref} className="session-dialog stack" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="card-heading">
          <h2 id="report-title">{target.messageId ? 'Report this message' : `Report ${target.personName}`}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {done ? (
          <div className="stack-sm">
            <p>Thank you. The MentorBridge team will look at it, usually within a few days. {target.personName} doesn’t see who reported.</p>
            <p className="muted">If you are in danger right now, call 112.</p>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="stack-sm" onSubmit={submit}>
            {target.messageText && <blockquote className="report-quote">{target.messageText}</blockquote>}
            <fieldset className="role-picker">
              <legend>What happened?</legend>
              {REASONS.map((r) => (
                <label key={r.value} className="radio">
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label className="w-full">More details (optional)
              <textarea rows={3} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="What happened, and when?" />
            </label>
            <p className="field-hint">Only the MentorBridge team sees your report. {target.personName} isn’t told who reported.</p>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send report'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
