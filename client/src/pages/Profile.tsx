import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { supabase, type Role } from '../lib/supabase'

type Field = {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'date' | 'select' | 'keywords'
  options?: string[]
  optionLabels?: Record<string, string>
  showWhen?: { field: string; value: string }
  required?: boolean
  hint?: string
}

const otherOption = '__other__'

// Shared lists, so a mentor's topics use the same words as a student's answers.
// Matching (server/src/matching.js) compares these words directly.
const fieldsOfStudy = ['ICT', 'Business', 'Engineering', 'Healthcare', 'Process and food technology', 'European studies', 'Education and pedagogy', 'Law', 'Interactive media', 'Finance']
const internshipTypes = ['Software development', 'IT support', 'Data analysis', 'Business and finance', 'Engineering', 'Healthcare', 'Education', 'Other']
const helpTopics = ['Industry insight', 'Interview practice', 'CV and applications', 'Workplace communication', 'Professional introductions']
const learningTopics = ['Software development', 'JavaScript', 'Python', 'Data analysis', 'Financial analysis', 'Project management', 'Communication', 'Industry knowledge']
const mentorTopics = [...new Set([...fieldsOfStudy, ...internshipTypes.filter((type) => type !== 'Other'), ...helpTopics, ...learningTopics])]

// Intake questions per role, stored in the matching *_profiles table.
const intake: Record<Exclude<Role, 'admin'>, { table: string; fields: Field[] }> = {
  student: {
    table: 'student_profiles',
    fields: [
      {
        name: 'field_of_study',
        label: 'Field of study',
        type: 'select',
        options: [...fieldsOfStudy, 'Other'],
        required: true,
      },
      {
        name: 'internship_type',
        label: 'Internship type or role',
        type: 'select',
        options: internshipTypes,
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
        label: 'What would you like help with?',
        type: 'keywords',
        options: helpTopics,
      },
      {
        name: 'learning_goals',
        label: 'What do you want to learn?',
        type: 'keywords',
        options: learningTopics,
        required: true,
        hint: 'Pick at least one. We use these to find a mentor who knows the topic.',
      },
    ],
  },
  company: {
    table: 'company_profiles',
    fields: [
      { name: 'organisation_name', label: 'Company name', required: true },
      { name: 'internship_position', label: 'Internship position (optional)' },
      { name: 'expectations', label: 'What do you expect from the intern? (optional)', type: 'textarea' },
      { name: 'tools', label: 'Tools the intern will use (optional)', type: 'textarea' },
      { name: 'first_tasks', label: 'Typical first tasks (optional)', type: 'textarea' },
    ],
  },
  mentor: {
    table: 'mentor_profiles',
    fields: [
      {
        name: 'expertise',
        label: 'What can you help students with?',
        type: 'keywords',
        options: mentorTopics,
        required: true,
        hint: 'Pick at least one. We match you with students who chose the same topics.',
      },
      {
        name: 'availability',
        label: 'Time you can give',
        type: 'select',
        options: ['1–2 hours a month', '3–5 hours a month', '6–10 hours a month', 'More than 10 hours a month'],
        required: true,
      },
      { name: 'background', label: 'Your work experience (optional)', type: 'textarea', hint: 'For example your job, your field and how long you have worked in it.' },
    ],
  },
}

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [searchParams] = useSearchParams()
  const welcome = searchParams.get('welcome') === '1'
  const [values, setValues] = useState<Record<string, string>>({})
  const [otherValues, setOtherValues] = useState<Record<string, string>>({})
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_path ?? null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [statusIsError, setStatusIsError] = useState(false)
  const [saved, setSaved] = useState(false)
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
    const missingKeywords = config.fields.find((field) => field.type === 'keywords' && field.required && !values[field.name]?.trim())
    if (missingKeywords) {
      showError(`Choose at least one option under "${missingKeywords.label}".`)
      return
    }
    setSaving(true)
    setStatus(null)
    setStatusIsError(false)
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
      showError(`Could not save. ${friendlyError(error)}`)
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
        showError(`Your answers are saved, but the picture could not be uploaded. ${friendlyError(uploadError)}`)
        return
      }
      nextAvatarPath = uploadedPath
    }
    const { error: detailsError } = await supabase.from('profiles').update({ bio: bio.trim() || null, avatar_path: nextAvatarPath }).eq('id', profile.id)
    if (detailsError) {
      if (uploadedPath) await supabase.storage.from('avatars').remove([uploadedPath])
      showError(`Could not save your photo and introduction. ${friendlyError(detailsError)}`)
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
          ? `Saved. We found ${result.created} new ${result.created === 1 ? 'match' : 'matches'} for you.`
          : 'Saved. No match yet. We look again when new people join and when you change your topics.')
      } catch {
        setStatus('Saved. We could not look for a match right now. We will try again later.')
      }
      setSaved(true)
      setSaving(false)
      return
    }
    setStatus('Saved.')
    setSaved(true)
    setSaving(false)
  }

  function showError(message: string) {
    setStatus(message)
    setStatusIsError(true)
    setSaved(false)
    setSaving(false)
  }

  function chooseAvatar(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showError('Choose a JPG, PNG or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showError('Choose an image smaller than 2 MB.')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setStatus(null)
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <div className="stack-sm">
        <h1>{welcome ? 'Welcome! A few quick questions' : 'Your profile'}</h1>
        <p className="muted">{welcome
          ? 'Your account is ready. Answer these so we can find you a match. It takes about two minutes.'
          : 'Your answers help us find the right match. Questions without "(optional)" are needed for matching.'}</p>
      </div>
      {config.fields.filter((field) => !field.showWhen || values[field.showWhen.field] === field.showWhen.value).map((f) => f.type === 'keywords' ? (
        <KeywordOptions
          key={f.name}
          label={f.label}
          hint={f.hint}
          options={f.options ?? []}
          value={values[f.name] ?? ''}
          onChange={(value) => setValues({ ...values, [f.name]: value })}
        />
      ) : (
        <label key={f.name}>
          {f.label}
          {f.type === 'select' ? (
            <>
              <select required={f.required} value={values[f.name] && !f.options?.includes(values[f.name]) ? otherOption : values[f.name] ?? ''} onChange={(event) => {
                const nextValues = { ...values, [f.name]: event.target.value }
                if (f.name === 'internship_start_preference' && event.target.value !== 'specific_date') nextValues.internship_start = ''
                setValues(nextValues)
              }}>
                <option value="">Choose an option</option>
                {f.options?.filter((option) => option !== 'Other').map((option) => <option value={option} key={option}>{f.optionLabels?.[option] ?? option}</option>)}
                {(f.options?.includes('Other') || (values[f.name] && !f.options?.includes(values[f.name]))) && <option value={otherOption}>Other</option>}
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
              required={f.required}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          ) : (
            <input
              required={f.required}
              type={f.type ?? 'text'}
              lang={f.type === 'date' ? 'en-GB' : undefined}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          )}
          {f.hint && <span className="field-hint">{f.hint}</span>}
        </label>
      ))}
      <section className="profile-intro-fields">
        <h2>About you (optional)</h2>
        <div className="profile-photo-picker">
          {avatarPreview ? <img className="profile-photo-preview" src={avatarPreview} alt="Your profile" /> : <span className="profile-photo-placeholder" aria-hidden="true">{profile.full_name?.slice(0, 1).toUpperCase() ?? '?'}</span>}
          <div className="profile-photo-control">
            <label className="btn btn-ghost btn-sm profile-photo-button" htmlFor="profile-picture">Choose picture</label>
            <input id="profile-picture" className="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="profile-photo-hint" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
          </div>
          <span id="profile-photo-hint" className="muted">JPG, PNG or WebP. Max 2 MB.</span>
        </div>
        <label>About you<textarea rows={3} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A short introduction about your experience and interests." /></label>
      </section>
      {status && (
        <div className={`alert ${statusIsError ? 'alert-error' : 'alert-info'}`} role={statusIsError ? 'alert' : 'status'}>
          <p>{status}</p>
          {saved && <Link className="link-button" to="/dashboard">Go to your dashboard</Link>}
        </div>
      )}
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
    </form>
  )
}

function KeywordOptions({ label, hint, options, value, onChange }: {
  label: string
  hint?: string
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
    {hint && <p className="field-hint">{hint}</p>}
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
