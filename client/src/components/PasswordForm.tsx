import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// Sets a new password for the logged-in user. Used on the reset page
// (after the email link) and on the Account page.
export default function PasswordForm({ submitLabel, onDone }: { submitLabel: string; onDone?: () => void }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (password !== repeat) return setError('The two passwords are not the same.')

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(
        /different from the old/i.test(error.message)
          ? 'Choose a password that is different from your old one.'
          : error.message,
      )
      return
    }
    setPassword('')
    setRepeat('')
    setSaved(true)
    onDone?.()
  }

  return (
    <form className="stack-sm w-full" onSubmit={handleSubmit}>
      <label className="w-full">
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      <label className="w-full">
        Repeat new password
        <input
          type="password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      {error && (
        <p className="alert alert-error w-full" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="alert alert-info w-full" role="status">
          Your new password is saved.
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Please wait…' : submitLabel}
      </button>
    </form>
  )
}
