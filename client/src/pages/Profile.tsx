import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/auth'
import { api } from '../lib/api'
import { supabase, type Role } from '../lib/supabase'

type Field = {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'date' | 'select' | 'keywords'
  options?: string[]
  optionLabels?: Record<string, string>
  showWhen?: { field: string; value: string }
}

const otherOption = '__other__'

// Intake questions per role, stored in the matching *_profiles table.
const intake: Record<Exclude<Role, 'admin'>, { table: string; fields: Field[] }> = {
  student: {
    table: 'student_profiles',
    fields: [
      {
        name: 'field_of_study',
        label: 'Field of study',
        type: 'select',
        options: ['ICT', 'Business', 'Engineering', 'Healthcare', 'Process and food technology', 'European studies', 'Education and pedagogy', 'Law', 'Interactive media', 'Finance'],
      },
      {
        name: 'internship_type',
        label: 'Internship type or role',
        type: 'select',
        options: ['Software development', 'IT support', 'Data analysis', 'Business and finance', 'Engineering', 'Healthcare', 'Education', 'Other'],
      },
      {
        name: 'internship_start_preference',
        label: 'When would you like to start?',
        type: 'select',
        options: ['spring', 'summer', 'autumn', 'specific_date'],
        optionLabels: { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', specific_date: 'Specific date' },
      },
      { name: 'internship_start', label: 'Specific start date', type: 'date', showWhen: { field: 'internship_start_preference', value: 'specific_date' } },
      {
        name: 'interests',
        label: 'Interests',
        type: 'keywords',
        options: ['Industry insight', 'Interview practice', 'CV and applications', 'Workplace communication', 'Professional introductions'],
      },
      {
        name: 'learning_goals',
        label: 'What do you want to learn?',
        type: 'keywords',
        options: ['Software development', 'JavaScript', 'Python', 'Data analysis', 'Financial analysis', 'Project management', 'Communication', 'Industry knowledge'],
      },
    ],
  },
  company: {
    table: 'company_profiles',
    fields: [
      { name: 'organisation_name', label: 'Organisation name' },
      { name: 'internship_position', label: 'Internship position' },
      { name: 'expectations', label: 'What do you expect from the intern?', type: 'textarea' },
      { name: 'tools', label: 'Tools the intern will use', type: 'textarea' },
      { name: 'first_tasks', label: 'Typical first tasks', type: 'textarea' },
    ],
  },
  mentor: {
    table: 'mentor_profiles',
    fields: [
      { name: 'background', label: 'Professional background', type: 'textarea' },
      { name: 'expertise', label: 'Mentoring keywords (comma separated)', type: 'textarea' },
      { name: 'availability', label: 'Availability (e.g. 2 hours a week, evenings)' },
    ],
  },
}

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [values, setValues] = useState<Record<string, string>>({})
  const [otherValues, setOtherValues] = useState<Record<string, string>>({})
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_path ?? null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const config = profile && profile.role !== 'admin' ? intake[profile.role] : null

  useEffect(() => {
    if (!profile || !config) return
    supabase
      .from(config.table)
      .select('*')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        const loadedValues = { ...(data ?? {}) }
        if (loadedValues.internship_start && !loadedValues.internship_start_preference) {
          loadedValues.internship_start_preference = 'specific_date'
        }
        setValues(loadedValues)
        setOtherValues(Object.fromEntries(config.fields
          .filter((field) => field.type === 'select' && loadedValues[field.name] && !field.options?.includes(loadedValues[field.name]))
          .map((field) => [field.name, loadedValues[field.name] ?? ''])))
      })
  }, [profile, config])

  useEffect(() => {
    if (!avatarPath) return
    let active = true
    void supabase.storage.from('avatars').createSignedUrl(avatarPath, 60 * 60)
      .then(({ data }) => { if (active && data?.signedUrl) setAvatarPreview(data.signedUrl) })
    return () => { active = false }
  }, [avatarPath])

  useEffect(() => () => {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  if (!profile) return null
  if (!config) return <p className="muted">Admins don't have an intake profile.</p>

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile || !config) return
    setSaving(true)
    setStatus(null)
    const row = Object.fromEntries(config.fields.map((field) => {
      const value = values[field.name]
      if (field.type === 'select' && (value === otherOption || (value && !field.options?.includes(value)))) {
        return [field.name, otherValues[field.name]?.trim() || null]
      }
      return [field.name, value || null]
    }))
    const { error } = await supabase
      .from(config.table)
      .upsert({ id: profile.id, ...row, updated_at: new Date().toISOString() })
    if (error) {
      setStatus(`Could not save: ${error.message}`)
      setSaving(false)
      return
    }

    let nextAvatarPath = avatarPath
    let uploadedPath: string | null = null
    if (avatarFile) {
      const extension = avatarFile.type === 'image/png' ? 'png' : avatarFile.type === 'image/webp' ? 'webp' : 'jpg'
      uploadedPath = `${profile.id}/avatar-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(uploadedPath, avatarFile, {
        contentType: avatarFile.type,
        upsert: true,
      })
      if (uploadError) {
        setStatus(`Profile details saved, but the picture could not be uploaded: ${uploadError.message}`)
        setSaving(false)
        return
      }
      nextAvatarPath = uploadedPath
    }
    const { error: detailsError } = await supabase.from('profiles').update({ bio: bio.trim() || null, avatar_path: nextAvatarPath }).eq('id', profile.id)
    if (detailsError) {
      if (uploadedPath) await supabase.storage.from('avatars').remove([uploadedPath])
      setStatus(`Could not save profile details: ${detailsError.message}`)
      setSaving(false)
      return
    }
    if (avatarPath && avatarPath !== nextAvatarPath) await supabase.storage.from('avatars').remove([avatarPath])
    setAvatarPath(nextAvatarPath)
    setAvatarFile(null)
    if (nextAvatarPath) {
      const { data } = await supabase.storage.from('avatars').createSignedUrl(nextAvatarPath, 60 * 60)
      if (data?.signedUrl) setAvatarPreview(data.signedUrl)
    }
    await refreshProfile()
    if (profile.role === 'student' || profile.role === 'mentor') {
      try {
        const result = await api<{ created: number }>('/me/auto-match', { method: 'POST' })
        setStatus(result.created
          ? `Saved. ${result.created} new ${result.created === 1 ? 'match was' : 'matches were'} created from shared keywords.`
          : 'Saved. No exact keyword match yet. We will check again when profile keywords change.')
      } catch (matchError) {
        setStatus(`Saved. Automatic matching could not run: ${matchError instanceof Error ? matchError.message : 'Unknown error'}`)
      }
      setSaving(false)
      return
    }
    setStatus('Saved.')
    setSaving(false)
  }

  function chooseAvatar(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setStatus('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatus('Choose an image smaller than 2 MB.')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setStatus(null)
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h1>Your profile</h1>
      <section className="profile-intro-fields">
        <div className="profile-photo-picker">
          {avatarPreview ? <img className="profile-photo-preview" src={avatarPreview} alt="Your profile" /> : <span className="profile-photo-placeholder" aria-hidden="true">{profile.full_name?.slice(0, 1).toUpperCase() ?? '?'}</span>}
          <div className="profile-photo-control">
            <label className="btn btn-ghost btn-sm profile-photo-button" htmlFor="profile-picture">Choose picture</label>
            <input id="profile-picture" className="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="profile-photo-hint" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
          </div>
          <span id="profile-photo-hint" className="muted">JPG, PNG, or WebP. Max 2 MB.</span>
        </div>
        <label>About you<textarea rows={3} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A short introduction about your experience and interests." /></label>
      </section>
      {config.fields.filter((field) => !field.showWhen || values[field.showWhen.field] === field.showWhen.value).map((f) => f.type === 'keywords' ? (
        <KeywordOptions
          key={f.name}
          label={f.label}
          options={f.options ?? []}
          value={values[f.name] ?? ''}
          onChange={(value) => setValues({ ...values, [f.name]: value })}
        />
      ) : (
        <label key={f.name}>
          {f.label}
          {f.type === 'select' ? (
            <>
              <select value={values[f.name] && !f.options?.includes(values[f.name]) ? otherOption : values[f.name] ?? ''} onChange={(event) => {
                const nextValues = { ...values, [f.name]: event.target.value }
                if (f.name === 'internship_start_preference' && event.target.value !== 'specific_date') nextValues.internship_start = ''
                setValues(nextValues)
              }}>
                <option value="">Choose an option</option>
                {f.options?.filter((option) => option !== 'Other').map((option) => <option value={option} key={option}>{f.optionLabels?.[option] ?? option}</option>)}
                {f.options?.includes('Other') && <option value={otherOption}>Other</option>}
              </select>
              {(values[f.name] === otherOption || (values[f.name] && !f.options?.includes(values[f.name]))) && (
                <input
                  type="text"
                  value={otherValues[f.name] ?? (values[f.name] === otherOption ? '' : values[f.name])}
                  onChange={(event) => {
                    setOtherValues({ ...otherValues, [f.name]: event.target.value })
                    setValues({ ...values, [f.name]: otherOption })
                  }}
                  placeholder={`Enter your ${f.label.toLowerCase()}`}
                  aria-label={`Other ${f.label.toLowerCase()}`}
                />
              )}
            </>
          ) : f.type === 'textarea' ? (
            <textarea
              rows={3}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          ) : (
            <input
              type={f.type ?? 'text'}
              lang={f.type === 'date' ? 'en-GB' : undefined}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          )}
        </label>
      ))}
      {profile.role === 'student' && <p className="muted">Matching uses your learning keywords and mentors' expertise keywords. Use comma-separated topics for the closest match.</p>}
      {status && <p className="alert alert-info">{status}</p>}
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
    </form>
  )
}

function KeywordOptions({ label, options, value, onChange }: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState('')
  const selected = value.split(/[,;|\n]+/).map((keyword) => keyword.trim()).filter(Boolean)

  function toggle(option: string) {
    const exists = selected.some((keyword) => keyword.toLocaleLowerCase() === option.toLocaleLowerCase())
    onChange((exists ? selected.filter((keyword) => keyword.toLocaleLowerCase() !== option.toLocaleLowerCase()) : [...selected, option]).join(', '))
  }

  function addCustom() {
    const keyword = draft.trim()
    if (!keyword || selected.some((item) => item.toLocaleLowerCase() === keyword.toLocaleLowerCase())) return
    onChange([...selected, keyword].join(', '))
    setDraft('')
  }

  return <fieldset className="keyword-picker">
    <legend>{label}</legend>
    <div className="keyword-options">
      {options.map((option) => <label className="keyword-option" key={option}>
        <input type="checkbox" checked={selected.some((keyword) => keyword.toLocaleLowerCase() === option.toLocaleLowerCase())} onChange={() => toggle(option)} />
        <span>{option}</span>
      </label>)}
    </div>
    <div className="keyword-tags" aria-label={`${label} selected`}>
      {selected.map((keyword) => <button className="keyword-tag" key={keyword} type="button" onClick={() => toggle(keyword)} aria-label={`Remove ${keyword}`}>{keyword}<span aria-hidden="true">×</span></button>)}
    </div>
    <div className="keyword-custom-entry">
      <label>Other keyword<input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom() } }} /></label>
      <button className="btn btn-ghost btn-sm" type="button" disabled={!draft.trim()} onClick={addCustom}>Add</button>
    </div>
  </fieldset>
}
