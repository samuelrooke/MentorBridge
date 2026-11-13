import { useEffect, useRef, useState, type FormEvent } from 'react'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

export type SessionReview = {
  session_id: string
  match_id: string
  author_id: string
  took_place: boolean
  rating: number | null
  went_well: string | null
  to_improve: string | null
  updated_at: string
}

const ratingLabels =['', 'Not useful', 'A little useful', 'Useful', 'Very useful', 'Excellent']

export function Stars({ rating }: { rating: number }) {
  return <span className="stars" aria-label={`${rating} out of 5: ${ratingLabels[rating]}`}>{'★'.repeat(rating)}<span aria-hidden="true" className="stars-empty">{'★'.repeat(5 - rating)}</span></span>
}

// Review of one session, by the student or the mentor. Both of them and the
// MentorBridge team can read it; companies can't.
export default function ReviewDialog({ sessionId, matchId, sessionTitle, otherName, existing, onClose, onSaved }: {
  sessionId: string
  matchId: string
  sessionTitle: string
  otherName: string
  existing: SessionReview | null
  onClose: () => void
  onSaved: () => void
}) {
  const [tookPlace, setTookPlace] = useState(existing ? existing.took_place : true)
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [wentWell, setWentWell] = useState(existing?.went_well ?? '')
  const [toImprove, setToImprove] = useState(existing?.to_improve ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, textarea, button')?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (tookPlace && !rating) return setError('Choose how useful the session was.')
    setSaving(true)
    setError(null)
    const { data: auth } = await supabase.auth.getUser()
    const { error: saveError } = await supabase.from('session_reviews').upsert({
      session_id: sessionId,
      match_id: matchId,
      author_id: auth.user?.id,
      took_place: tookPlace,
      rating: tookPlace ? rating : null,
      went_well: tookPlace ? wentWell.trim() || null : null,
      to_improve: toImprove.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id,author_id' })
    setSaving(false)
    if (saveError) return setError(friendlyError(saveError))
    onSaved()
    onClose()
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <form ref={ref} className="session-dialog stack" role="dialog" aria-modal="true" aria-labelledby="review-title" onSubmit={save}>
        <div className="card-heading">
          <div><p className="eyebrow">Review</p><h2 id="review-title">{sessionTitle}</h2></div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <fieldset className="role-picker">
          <legend>Did the session take place?</legend>
          <label className="radio"><input type="radio" name="took_place" checked={tookPlace} onChange={() => setTookPlace(true)} /> Yes</label>
          <label className="radio"><input type="radio" name="took_place" checked={!tookPlace} onChange={() => setTookPlace(false)} /> No, it didn’t happen</label>
        </fieldset>

        {tookPlace && (
          <>
            <fieldset className="rating-picker">
              <legend>How useful was it?</legend>
              <div className="rating-options">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value} className={`rating-option${rating >= value ? ' filled' : ''}`} title={ratingLabels[value]}>
                    <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} />
                    <span aria-hidden="true">★</span>
                    <span className="sr-only">{value}: {ratingLabels[value]}</span>
                  </label>
                ))}
                <span className="rating-text">{rating ? ratingLabels[rating] : 'Choose 1 to 5 stars'}</span>
              </div>
            </fieldset>
            <label className="w-full">What went well? <span className="muted">(optional)</span>
              <textarea rows={3} maxLength={2000} value={wentWell} onChange={(event) => setWentWell(event.target.value)} />
            </label>
          </>
        )}
        <label className="w-full">{tookPlace ? 'What could be better next time?' : 'What happened?'} <span className="muted">(optional)</span>
          <textarea rows={3} maxLength={2000} value={toImprove} onChange={(event) => setToImprove(event.target.value)} />
        </label>
        <p className="field-hint">{otherName} and the MentorBridge team can read your review. Companies can’t.</p>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : existing ? 'Save changes' : 'Save review'}</button>
        </div>
      </form>
    </div>
  )
}
