const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const form = document.querySelector('#pilot-form')
const button = form.querySelector('button[type="submit"]')
const errorBox = document.querySelector('#form-error')
const thanks = document.querySelector('#pilot-thanks')

// ---- Language ----
// The Dutch page (nl/index.html) is generated from index.html; texts set from JavaScript live here.
const LANG = document.documentElement.lang === 'nl' ? 'nl' : 'en'

const UI = {
  en: {
    sending: 'Sending…',
    sendAnswers: 'Send answers',
    sendMessage: 'Send message',
    errorGeneric: 'Sorry, something went wrong. Please try again in a moment.',
    errorAnswers: 'Sorry, something went wrong. You can try again or skip.',
    errorOffline: "Sorry, we couldn't send your details. Check your connection and try again.",
    errorOfflineAnswers: "Sorry, we couldn't send your answers. Check your connection and try again, or skip.",
    errorOfflineMessage: "Sorry, we couldn't send your message. Check your connection and try again.",
    play: 'Play slideshow',
    pause: 'Pause slideshow',
  },
  nl: {
    sending: 'Versturen…',
    sendAnswers: 'Antwoorden versturen',
    sendMessage: 'Bericht versturen',
    errorGeneric: 'Sorry, er ging iets mis. Probeer het zo nog eens.',
    errorAnswers: 'Sorry, er ging iets mis. Probeer het opnieuw of sla over.',
    errorOffline: 'Sorry, we konden je gegevens niet versturen. Controleer je verbinding en probeer het opnieuw.',
    errorOfflineAnswers: 'Sorry, we konden je antwoorden niet versturen. Controleer je verbinding en probeer het opnieuw, of sla over.',
    errorOfflineMessage: 'Sorry, we konden je bericht niet versturen. Controleer je verbinding en probeer het opnieuw.',
    play: 'Diavoorstelling afspelen',
    pause: 'Diavoorstelling pauzeren',
  },
}
const t = UI[LANG]

// The API answers in English; on the Dutch page its validation messages are translated here.
const SERVER_NL = {
  'Please choose student, mentor or organization.': 'Kies student, mentor of organisatie.',
  'Please enter your email.': 'Vul je e-mailadres in.',
  'Please enter a valid email address.': 'Vul een geldig e-mailadres in.',
  'Please enter your organization name.': 'Vul de naam van je organisatie in.',
  'Organization name must be 200 characters or fewer.': 'De naam van je organisatie mag maximaal 200 tekens zijn.',
  'Please choose how many interns you take per year.': 'Kies hoeveel stagiairs je per jaar aanneemt.',
  'Please enter your field of study.': 'Vul je opleiding in.',
  'Please enter your field of work.': 'Vul je vakgebied in.',
  'Field must be 200 characters or fewer.': 'Dit veld mag maximaal 200 tekens zijn.',
  'Please choose yes or no.': 'Kies ja of nee.',
  'Please choose how many applications you sent.': 'Kies hoeveel sollicitaties je hebt verstuurd.',
  'Please choose when you need your internship.': 'Kies wanneer je je stage nodig hebt.',
  'Please choose from the listed kinds of help.': 'Kies uit de genoemde soorten hulp.',
  'Please enter your name.': 'Vul je naam in.',
  'Name must be 100 characters or fewer.': 'Je naam mag maximaal 100 tekens zijn.',
  'Please write a message.': 'Schrijf een bericht.',
  'Message must be 2000 characters or fewer.': 'Je bericht mag maximaal 2000 tekens zijn.',
}
function serverError(message, fallback) {
  if (!message) return fallback
  return LANG === 'nl' ? (SERVER_NL[message] ?? fallback) : message
}

// Remember the chosen language for the next visit.
for (const link of document.querySelectorAll('[data-lang]')) {
  link.addEventListener('click', () => {
    try {
      localStorage.setItem('mb-lang', link.dataset.lang)
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  })
}

// Text that changes with the chosen role.
const COPY = {
  en: {
    student: {
      heading: 'Find your match',
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
  },
  nl: {
    student: {
      heading: 'Vind jouw match',
      text: 'Laat je gegevens achter, dan nemen we contact op zodra we je kunnen koppelen aan een mentor uit je vakgebied. Gratis voor studenten.',
      emailLabel: 'E-mail',
      fieldLabel: 'Opleiding',
      button: 'Aanmelden als student',
      event: 'signup-student',
    },
    mentor: {
      heading: 'Help een student aan een stage',
      text: 'Laat je gegevens achter, dan nemen we contact op zodra er een student uit jouw vakgebied is.',
      emailLabel: 'E-mail',
      fieldLabel: 'Jouw vakgebied',
      button: 'Aanmelden als mentor',
      event: 'signup-mentor',
    },
    company: {
      heading: 'Probeer het met je volgende stagiair',
      text: 'We draaien gratis pilots met een klein aantal organisaties. Laat je gegevens achter, dan nemen we contact op.',
      emailLabel: 'Zakelijk e-mailadres',
      button: 'Vraag een gratis pilot aan',
      event: 'pilot-request',
    },
  },
}
const copy = COPY[LANG]

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
  const data = { ...Object.fromEntries(new FormData(form)), variant }
  const label = button.textContent
  button.disabled = true
  button.textContent = t.sending

  try {
    const res = await fetch(`${API_URL}/api/pilot-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      // Count the conversion in GoatCounter, if it has loaded.
      window.goatcounter?.count?.({ path: copy[role].event, title: copy[role].button, event: true })
      window.dataLayer?.push({ event: 'sign_up', role, variant })
      if (document.querySelector('#ga-script')) window.gtag('event', 'sign_up', { role, variant })
      const body = await res.json().catch(() => ({}))
      form.hidden = true
      // Students get four optional follow-up questions; everyone else sees the thank-you.
      if (role === 'student' && body.id) showAnswers(body.id)
      else showThanks()
      return
    }

    const body = await res.json().catch(() => ({}))
    showError(res.status === 400 ? serverError(body.error, t.errorGeneric) : t.errorGeneric)
  } catch {
    showError(t.errorOffline)
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
  answersButton.textContent = t.sending
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
    answersError.textContent = res.status === 400 ? serverError(body.error, t.errorAnswers) : t.errorAnswers
    answersError.hidden = false
  } catch {
    answersError.textContent = t.errorOfflineAnswers
    answersError.hidden = false
  } finally {
    answersButton.disabled = false
    answersButton.textContent = t.sendAnswers
  }
})

// The hero speaks to students first, so the form starts on the student role.
form.elements.role.value = 'student'
setRole('student')



// ---- Google Analytics and Tag Manager, only with consent ----
// Both set cookies, so they load only after the visitor accepts (Google Consent Mode v2,
// analytics only, advertising always denied). Without either ID nothing happens.
// GA4 is loaded directly, so it measures without any setup in Tag Manager; don't also
// add a GA4 tag in Tag Manager, or page views are counted twice.
const GTM_ID = import.meta.env.VITE_GTM_ID
const GA_ID = import.meta.env.VITE_GA_ID
const CONSENT_KEY = 'mb-analytics-consent'
const cookieBar = document.querySelector('#cookie-bar')
const cookieSettings = document.querySelector('[data-cookie-settings]')

window.dataLayer = window.dataLayer || []
function gtag() {
  window.dataLayer.push(arguments)
}
window.gtag = gtag

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch {
    return null
  }
}

function addScript(id, src) {
  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.src = src
  document.head.append(script)
}

function loadGtm() {
  if (document.querySelector('#gtm-script') || document.querySelector('#ga-script')) return
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  if (GA_ID) {
    gtag('js', new Date())
    gtag('config', GA_ID)
    addScript('ga-script', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`)
  }
  if (GTM_ID) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    addScript('gtm-script', `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`)
  }
}

function setConsent(choice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice)
  } catch {
    // Private mode: the choice just isn't remembered.
  }
  cookieBar.hidden = true
  if (choice === 'granted') loadGtm()
  // Withdrawing consent after GTM loaded: tell Google to stop, the reload clears it.
  else if (document.querySelector('#gtm-script, #ga-script')) {
    gtag('consent', 'update', { analytics_storage: 'denied' })
    location.reload()
  }
}

if (GTM_ID || GA_ID) {
  cookieSettings.hidden = false
  cookieSettings.addEventListener('click', () => {
    cookieBar.hidden = false
  })
  for (const button of cookieBar.querySelectorAll('[data-consent]')) {
    button.addEventListener('click', () => setConsent(button.dataset.consent))
  }
  const consent = readConsent()
  if (consent === 'granted') loadGtm()
  else if (consent !== 'denied') cookieBar.hidden = false
}


// ---- A/B test of the hero headline ----
// Variant A: "Find your match." Variant B: "Find your internship with a mentor."
// Each visitor keeps their variant (localStorage). ?variant=a or ?variant=b forces one, for checking.
// GoatCounter gets one event per visit (ab/hero-a or ab/hero-b), and every sign-up stores its variant,
// so conversion per variant = sign-ups with that variant ÷ ab/hero-<variant> visits.
const AB_KEY = 'mb-ab-hero'
function pickVariant() {
  const forced = new URLSearchParams(location.search).get('variant')
  if (forced === 'a' || forced === 'b') return forced
  try {
    const saved = localStorage.getItem(AB_KEY)
    if (saved === 'a' || saved === 'b') return saved
    const fresh = Math.random() < 0.5 ? 'a' : 'b'
    localStorage.setItem(AB_KEY, fresh)
    return fresh
  } catch {
    return Math.random() < 0.5 ? 'a' : 'b'
  }
}
const variant = pickVariant()
for (const el of document.querySelectorAll('[data-variant]')) el.hidden = el.dataset.variant !== variant

// GoatCounter loads async, so wait for it (up to 10 s) before counting the variant.
function countWhenReady(event, tries = 20) {
  if (window.goatcounter?.count) window.goatcounter.count({ path: event, title: event, event: true })
  else if (tries > 0) setTimeout(() => countWhenReady(event, tries - 1), 500)
}
countWhenReady(`ab/hero-${variant}`)

// ---- Contact form ----
const contactForm = document.querySelector('#contact-form')
const contactButton = contactForm.querySelector('button[type="submit"]')
const contactError = document.querySelector('#contact-error')
const contactThanks = document.querySelector('#contact-thanks')

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  contactError.hidden = true
  if (!contactForm.reportValidity()) return

  contactButton.disabled = true
  contactButton.textContent = t.sending
  try {
    const res = await fetch(`${API_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(contactForm))),
    })
    if (res.ok) {
      contactForm.hidden = true
      contactThanks.hidden = false
      contactThanks.focus()
      window.goatcounter?.count?.({ path: 'contact-message', title: 'Contact message', event: true })
      return
    }
    const body = await res.json().catch(() => ({}))
    contactError.textContent = res.status === 400 ? serverError(body.error, t.errorGeneric) : t.errorGeneric
    contactError.hidden = false
  } catch {
    contactError.textContent = t.errorOfflineMessage
    contactError.hidden = false
  } finally {
    contactButton.disabled = false
    contactButton.textContent = t.sendMessage
  }
})

// ---- Hero slideshow ----
// Advances every 4 s (under the 5 s limit). Dots jump to a slide, the button pauses.
// It pauses while hovered or focused, and does not auto-play for reduced motion.
const slideshow = document.querySelector('.slideshow')
if (slideshow) {
  const slides = [...slideshow.querySelectorAll('.slide')]
  const dots = [...slideshow.querySelectorAll('.slide-dot')]
  const pauseButton = slideshow.querySelector('[data-slide-pause]')
  const SLIDE_MS = 4000
  let current = 0
  let timer = null
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let hovering = false

  function show(index) {
    current = (index + slides.length) % slides.length
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === current)
      slide.setAttribute('aria-hidden', String(i !== current))
    })
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)))
  }

  function schedule() {
    clearInterval(timer)
    timer = paused || hovering ? null : setInterval(() => show(current + 1), SLIDE_MS)
  }

  function setPaused(value) {
    paused = value
    slideshow.classList.toggle('is-paused', paused)
    pauseButton.setAttribute('aria-label', paused ? t.play : t.pause)
    schedule()
  }

  dots.forEach((dot) =>
    dot.addEventListener('click', () => {
      show(Number(dot.dataset.slide))
      schedule()
    }),
  )
  pauseButton.addEventListener('click', () => setPaused(!paused))
  slideshow.addEventListener('mouseenter', () => { hovering = true; schedule() })
  slideshow.addEventListener('mouseleave', () => { hovering = false; schedule() })
  slideshow.addEventListener('focusin', () => { hovering = true; schedule() })
  slideshow.addEventListener('focusout', () => { hovering = false; schedule() })

  show(0)
  setPaused(paused)
}

// ---- Header: shadow once scrolled, menu on small screens ----
const header = document.querySelector('[data-header]')
const menuButton = document.querySelector('[data-menu-button]')
const mobileMenu = document.querySelector('#mobile-menu')

const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

function setMenu(open) {
  menuButton.setAttribute('aria-expanded', String(open))
  mobileMenu.hidden = !open
}
menuButton.addEventListener('click', () => setMenu(mobileMenu.hidden))
mobileMenu.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false)
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !mobileMenu.hidden) {
    setMenu(false)
    menuButton.focus()
  }
})
// Close the phone menu when the desktop header takes over (the button is hidden from lg).
window.matchMedia('(min-width: 64rem)').addEventListener('change', (event) => {
  if (event.matches) setMenu(false)
})

// Scrollspy: mark the section in view as the current location in both menus.
const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"], .mobile-links > a[href^="#"]')]
const spySections = [...new Set(navLinks.map((a) => a.getAttribute('href')))]
  .map((hash) => document.querySelector(hash))
  .filter(Boolean)
const spy = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const hash = '#' + entry.target.id
      for (const link of navLinks) {
        if (link.getAttribute('href') === hash) link.setAttribute('aria-current', 'location')
        else link.removeAttribute('aria-current')
      }
    }
  },
  // A section counts as current while it crosses a band just below the header.
  { rootMargin: '-30% 0px -60% 0px' },
)
spySections.forEach((section) => spy.observe(section))

// ---- Log in: the button goes to the platform app ----
// The HTML points at the live app; VITE_APP_URL overrides it (e.g. http://localhost:5173 locally).
const APP_URL = (import.meta.env.VITE_APP_URL ?? '').replace(/\/$/, '')
if (APP_URL) for (const link of document.querySelectorAll('[data-app-login]')) link.href = `${APP_URL}/login`
