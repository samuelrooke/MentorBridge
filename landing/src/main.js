const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// Every page loads this script, but not every page has every part (the front page has no
// waiting list form, only the student page has the slideshow), so each part checks first.

// ---- Language ----
// The Dutch pages (nl/...) are generated from the English ones; texts set from JavaScript live here.
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
    errorAvailability: 'Please choose when you are available.',
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
    errorAvailability: 'Kies wanneer je beschikbaar bent.',
    play: 'Diavoorstelling afspelen',
    pause: 'Diavoorstelling pauzeren',
  },
}
const t = UI[LANG]

// The API answers in English; on the Dutch pages its validation messages are translated here.
const SERVER_NL = {
  'Please choose student, mentor or company.': 'Kies student, mentor of bedrijf.',
  'Please enter your name.': 'Vul je naam in.',
  'Please enter your contact name.': 'Vul de naam van de contactpersoon in.',
  'Name must be 100 characters or fewer.': 'Je naam mag maximaal 100 tekens zijn.',
  'Please enter your email.': 'Vul je e-mailadres in.',
  'Please enter a valid email address.': 'Vul een geldig e-mailadres in.',
  'Please choose a sector.': 'Kies een sector.',
  'Please choose a sector from the list.': 'Kies een sector uit de lijst.',
  'Please enter your company name.': 'Vul de naam van je bedrijf in.',
  'Company name must be 200 characters or fewer.': 'De naam van je bedrijf mag maximaal 200 tekens zijn.',
  'Please enter your role.': 'Vul je functie in.',
  'Role must be 100 characters or fewer.': 'Je functie mag maximaal 100 tekens zijn.',
  'Please choose a company size from the list.': 'Kies een aantal medewerkers uit de lijst.',
  'Please choose how you would like to use MentorBridge.': 'Kies hoe je MentorBridge wilt gebruiken.',
  'Please choose when you are available.': 'Kies wanneer je beschikbaar bent.',
  'Please choose from the listed times.': 'Kies uit de genoemde tijden.',
  'Please choose your age range.': 'Kies je leeftijd.',
  'Please choose how many hours a month you have.': 'Kies hoeveel uur per maand je hebt.',
  'Please choose what you want help with.': 'Kies waar je hulp bij wilt.',
  'Please agree to the privacy statement.': 'Ga akkoord met de privacyverklaring.',
  'Please choose yes or no.': 'Kies ja of nee.',
  'Please choose how many applications you sent.': 'Kies hoeveel sollicitaties je hebt verstuurd.',
  'Please choose when you need your internship.': 'Kies wanneer je je stage nodig hebt.',
  'Please choose from the listed kinds of help.': 'Kies uit de genoemde soorten hulp.',
  'Please write a message.': 'Schrijf een bericht.',
  'Message must be 2000 characters or fewer.': 'Je bericht mag maximaal 2000 tekens zijn.',
}
function serverError(message, fallback) {
  if (!message) return fallback
  return LANG === 'nl' ? (SERVER_NL[message] ?? fallback) : message
}

// GoatCounter loads async; events sent before it's ready wait (up to 10 s).
function countEvent(path, title = path, tries = 20) {
  if (window.goatcounter?.count) window.goatcounter.count({ path, title, event: true })
  else if (tries > 0) setTimeout(() => countEvent(path, title, tries - 1), 500)
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

// ---- Where the visitor came from ----
// UTM tags from the link, the referring site (host name only) and the first page of the visit.
// Kept for the browser session and sent with the sign-up. A link with new UTM tags replaces them.
// The tag names the team uses are in docs/utm.md.
const SOURCE_KEY = 'mb-source'
function readSource() {
  const params = new URLSearchParams(location.search)
  const fresh = {
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
    referrer: undefined,
    landing_path: location.pathname,
  }
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : ''
    if (host && host !== location.hostname) fresh.referrer = host
  } catch {
    // Not a valid URL: no referrer.
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(SOURCE_KEY) ?? 'null')
    if (saved && !fresh.utm_source && !fresh.utm_medium && !fresh.utm_campaign) return saved
    sessionStorage.setItem(SOURCE_KEY, JSON.stringify(fresh))
  } catch {
    // Storage blocked: use what this page knows.
  }
  return fresh
}
const source = readSource()

// ---- A/B test of the hero headline (student page only) ----
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
const variantEls = document.querySelectorAll('[data-variant]')
const variant = variantEls.length ? pickVariant() : undefined
if (variant) {
  for (const el of variantEls) el.hidden = el.dataset.variant !== variant
  countEvent(`ab/hero-${variant}`)
}

// ---- Waiting list form ----
// One form for all three segments. The page says which segment it is (<body data-segment>).
// GoatCounter counts page views per page (/students/, /mentors/, /companies/ and the /nl/ versions),
// plus the events form-start-<segment> and signup-<segment>, so
// conversion per segment = signup-<segment> ÷ views of that segment's pages.
const form = document.querySelector('#pilot-form')
if (form) {
  const segment = document.body.dataset.segment
  const button = form.querySelector('button[type="submit"]')
  const errorBox = document.querySelector('#form-error')
  const thanks = document.querySelector('#pilot-thanks')
  const answersForm = document.querySelector('#answers-form')
  const answersButton = answersForm.querySelector('button[type="submit"]')
  const answersError = document.querySelector('#answers-error')
  const availability = form.querySelector('[data-availability]')
  let signupId = null

  const BUTTON = {
    en: { student: 'Find a mentor', mentor: 'Sign up as a mentor', company: 'Sign up as a company' },
    nl: { student: 'Vind een mentor', mentor: 'Meld je aan als mentor', company: 'Meld je aan als bedrijf' },
  }

  // Show the fields for this segment. Hidden fields are disabled, so they are neither checked nor sent.
  for (const group of form.querySelectorAll('[data-for-role]')) {
    const visible = group.dataset.forRole.split(' ').includes(segment)
    group.hidden = !visible
    for (const input of group.querySelectorAll('input, select')) input.disabled = !visible
  }
  // Sector is optional for mentors only.
  form.elements.sector.required = segment !== 'mentor'
  button.textContent = BUTTON[LANG][segment]

  const showError = (message) => {
    errorBox.textContent = message
    errorBox.hidden = false
  }

  // Count the first time someone starts filling in the form.
  form.addEventListener('focusin', () => countEvent(`form-start-${segment}`, `Form started: ${segment}`), { once: true })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    errorBox.hidden = true

    // Let the browser explain missing or invalid fields first.
    if (!form.reportValidity()) return
    const fields = new FormData(form)
    // Checkbox groups can't be marked required in HTML, so check "at least one" here.
    if (availability && !availability.hidden && !fields.getAll('availability').length) {
      showError(t.errorAvailability)
      availability.querySelector('input').focus()
      return
    }

    const data = {
      ...Object.fromEntries(fields),
      availability: fields.getAll('availability'),
      consent: form.elements.consent.checked,
      variant,
      ...source,
    }
    const label = button.textContent
    button.disabled = true
    button.textContent = t.sending

    try {
      const res = await fetch(`${API_URL}/api/pilot-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => ({}))

      if (res.ok) {
        countEvent(`signup-${segment}`, `Signed up: ${segment}`)
        window.dataLayer?.push({ event: 'sign_up', role: segment, variant })
        if (document.querySelector('#ga-script')) window.gtag('event', 'sign_up', { role: segment, variant })
        form.hidden = true
        // Students get four optional follow-up questions; everyone else sees the thank-you.
        if (segment === 'student' && body.id) showAnswers(body.id)
        else showThanks()
        return
      }
      // Already on the list for this segment: nothing to fix, so say so kindly.
      if (res.status === 409 && body.duplicate) {
        form.hidden = true
        showThanks({ duplicate: true })
        return
      }
      showError(res.status === 400 ? serverError(body.error, t.errorGeneric) : t.errorGeneric)
    } catch {
      showError(t.errorOffline)
    } finally {
      button.disabled = false
      button.textContent = label
    }
  })

  function showThanks({ duplicate = false } = {}) {
    answersForm.hidden = true
    thanks.querySelector('[data-thanks="new"]').hidden = duplicate
    thanks.querySelector('[data-thanks="duplicate"]').hidden = !duplicate
    thanks.hidden = false
    thanks.focus()
  }

  // ---- Step 2: optional follow-up questions for students ----
  function showAnswers(id) {
    signupId = id
    answersForm.hidden = false
    answersForm.focus()
  }

  document.querySelector('#answers-skip').addEventListener('click', () => showThanks())

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
        countEvent('student-answers', 'Student answered questions')
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
}

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

// ---- Contact form ----
const contactForm = document.querySelector('#contact-form')
if (contactForm) {
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
        countEvent('contact-message', 'Contact message')
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
}

// ---- Hero slideshow (student page) ----
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

// ---- Log in: the button goes to the platform app ----
// The HTML links to /login on mentorbridge.nl (landing/vercel.json forwards it to the app).
// VITE_APP_URL overrides it, e.g. http://localhost:5173 when running locally.
const APP_URL = (import.meta.env.VITE_APP_URL ?? '').replace(/\/$/, '')
if (APP_URL) for (const link of document.querySelectorAll('[data-app-login]')) link.href = `${APP_URL}/login`
