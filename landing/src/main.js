const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const form = document.querySelector('#pilot-form')
const button = form.querySelector('button[type="submit"]')
const errorBox = document.querySelector('#form-error')
const thanks = document.querySelector('#pilot-thanks')

// Text that changes with the chosen role.
const copy = {
  student: {
    heading: 'Find your internship with a mentor',
    text: "Leave your details and we'll get in touch when we can match you with a mentor from your field. Free for students.",
    emailLabel: 'Email',
    fieldLabel: 'Field of study',
    button: 'Sign up as a student',
    event: 'signup-student',
  },
  mentor: {
    heading: 'Help a student find their internship',
    text: "Leave your details and we'll get in touch when there's a student from your field.",
    emailLabel: 'Email',
    fieldLabel: 'Your field of work',
    button: 'Sign up as a mentor',
    event: 'signup-mentor',
  },
  company: {
    heading: 'Try it with your next intern',
    text: "We're running free pilots with a small number of organizations. Leave your details and we'll get in touch.",
    emailLabel: 'Work email',
    button: 'Request a free pilot',
    event: 'pilot-request',
  },
}

// Show the fields for one role. Hidden fields are disabled, so they are
// neither validated nor sent.
function setRole(role) {
  const text = copy[role]
  for (const el of document.querySelectorAll('[data-copy]')) {
    if (text[el.dataset.copy]) el.textContent = text[el.dataset.copy]
  }
  for (const group of form.querySelectorAll('[data-for-role]')) {
    const visible = group.dataset.forRole.split(' ').includes(role)
    group.hidden = !visible
    for (const input of group.querySelectorAll('input, select')) input.disabled = !visible
  }
  errorBox.hidden = true
}

form.addEventListener('change', (event) => {
  if (event.target.name === 'role') setRole(event.target.value)
})

// "Sign up as a student/mentor" buttons pick the role before jumping to the form.
for (const link of document.querySelectorAll('a[data-role]')) {
  link.addEventListener('click', () => {
    form.elements.role.value = link.dataset.role
    setRole(link.dataset.role)
  })
}

function showError(message) {
  errorBox.textContent = message
  errorBox.hidden = false
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  errorBox.hidden = true

  // Let the browser explain missing or invalid fields first.
  if (!form.reportValidity()) return

  const role = form.elements.role.value
  const data = Object.fromEntries(new FormData(form))
  const label = button.textContent
  button.disabled = true
  button.textContent = 'Sending…'

  try {
    const res = await fetch(`${API_URL}/api/pilot-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      // Count the conversion in GoatCounter, if it has loaded.
      window.goatcounter?.count?.({ path: copy[role].event, title: copy[role].button, event: true })
      const body = await res.json().catch(() => ({}))
      form.hidden = true
      // Students get four optional follow-up questions; everyone else sees the thank-you.
      if (role === 'student' && body.id) showAnswers(body.id)
      else showThanks()
      return
    }

    const body = await res.json().catch(() => ({}))
    showError(res.status === 400 && body.error ? body.error : 'Sorry, something went wrong. Please try again in a moment.')
  } catch {
    showError("Sorry, we couldn't send your details. Check your connection and try again.")
  } finally {
    button.disabled = false
    button.textContent = label
  }
})

function showThanks() {
  answersForm.hidden = true
  thanks.hidden = false
  thanks.focus()
}

// ---- Step 2: optional follow-up questions for students ----
const answersForm = document.querySelector('#answers-form')
const answersButton = answersForm.querySelector('button[type="submit"]')
const answersError = document.querySelector('#answers-error')
let signupId = null

function showAnswers(id) {
  signupId = id
  answersForm.hidden = false
  answersForm.focus()
}

document.querySelector('#answers-skip').addEventListener('click', showThanks)

answersForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  answersError.hidden = true

  const fields = new FormData(answersForm)
  const answers = {
    has_placement: fields.get('has_placement'),
    applications_sent: fields.get('applications_sent'),
    help_wanted: fields.getAll('help_wanted'),
    needed_by: fields.get('needed_by'),
  }
  // Nothing chosen is the same as skipping.
  if (!answers.has_placement && !answers.applications_sent && !answers.help_wanted.length && !answers.needed_by) {
    return showThanks()
  }

  answersButton.disabled = true
  answersButton.textContent = 'Sending…'
  try {
    const res = await fetch(`${API_URL}/api/pilot-requests/${signupId}/answers`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    })
    if (res.ok) {
      window.goatcounter?.count?.({ path: 'student-answers', title: 'Student answered questions', event: true })
      return showThanks()
    }
    const body = await res.json().catch(() => ({}))
    answersError.textContent = res.status === 400 && body.error ? body.error : 'Sorry, something went wrong. You can try again or skip.'
    answersError.hidden = false
  } catch {
    answersError.textContent = "Sorry, we couldn't send your answers. Check your connection and try again, or skip."
    answersError.hidden = false
  } finally {
    answersButton.disabled = false
    answersButton.textContent = 'Send answers'
  }
})

// The hero speaks to students first, so the form starts on the student role.
form.elements.role.value = 'student'
setRole('student')

// Sections rise in as they scroll into view, and stats count up once.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function countUp(el) {
  const target = Number(el.dataset.count)
  const start = performance.now()
  const step = (now) => {
    const t = Math.min((now - start) / 1200, 1)
    el.textContent = Math.round(target * (1 - (1 - t) ** 3))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-visible')
      if (!reduceMotion) entry.target.querySelectorAll('[data-count]').forEach(countUp)
      observer.unobserve(entry.target)
    }
  },
  { threshold: 0.15 },
)
document.querySelectorAll('.scroll-reveal').forEach((el) => observer.observe(el))
