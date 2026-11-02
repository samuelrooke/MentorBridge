import './style.css'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const form = document.querySelector('#pilot-form')
const button = form.querySelector('button[type="submit"]')
const errorBox = document.querySelector('#form-error')
const thanks = document.querySelector('#pilot-thanks')

function showError(message) {
  errorBox.textContent = message
  errorBox.hidden = false
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  errorBox.hidden = true

  // Let the browser explain missing or invalid fields first.
  if (!form.reportValidity()) return

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
      form.hidden = true
      thanks.hidden = false
      thanks.focus()
      // Count the conversion in GoatCounter, if it has loaded.
      window.goatcounter?.count?.({ path: 'pilot-request', title: 'Pilot request', event: true })
      return
    }

    const body = await res.json().catch(() => ({}))
    showError(res.status === 400 && body.error ? body.error : 'Sorry, something went wrong. Please try again in a moment.')
  } catch {
    showError("Sorry, we couldn't send your request. Check your connection and try again.")
  } finally {
    button.disabled = false
    button.textContent = label
  }
})
