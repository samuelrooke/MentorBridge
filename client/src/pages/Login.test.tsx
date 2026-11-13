import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthContext, type AuthState } from '../context/auth'
import { friendlyError, genericError } from '../lib/errors'
import Login from './Login'

const signedOut: AuthState = {
  session: null,
  profile: null,
  loading: false,
  refreshProfile: async () => {},
  signOut: async () => {},
}

function renderLogin(url = '/login') {
  return render(
    <AuthContext.Provider value={signedOut}>
      <MemoryRouter initialEntries={[url]}>
        <Login />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Login', () => {
  it('shows the login form by default', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: 'Log in', pressed: true })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Log in' }).at(-1)).toHaveAttribute('type', 'submit')
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
  })

  it('puts Create account before Log in', () => {
    renderLogin()
    const tabs = screen.getByRole('group', { name: 'Log in or create an account' })
    expect([...tabs.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Create account', 'Log in'])
  })

  it('links back to the homepage', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /Back to the homepage/ })).toHaveAttribute('href', '/')
  })

  it('switches to sign up and asks for a role first, then name', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Create account', pressed: false }))
    expect(screen.getByLabelText('First name')).toHaveAttribute('autocomplete', 'given-name')
    expect(screen.getByLabelText('Surname')).toHaveAttribute('autocomplete', 'family-name')
    expect(screen.getByRole('radio', { name: /Student/ })).toBeChecked()
  })

  it('opens on the sign-up tab with ?mode=signup', () => {
    renderLogin('/login?mode=signup')
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
  })

  it('preselects the role from ?role=mentor', () => {
    renderLogin('/login?role=mentor')
    expect(screen.getByRole('radio', { name: /Mentor/ })).toBeChecked()
  })

  it('shows or hides the password', async () => {
    renderLogin()
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(input).toHaveAttribute('type', 'text')
  })
})

describe('friendlyError', () => {
  it('rewrites known auth errors', () => {
    expect(friendlyError({ message: 'Invalid login credentials' })).toMatch(/don’t match/)
    expect(friendlyError(new Error('User already registered'))).toMatch(/already an account/)
  })

  it('never shows unknown technical messages', () => {
    expect(friendlyError({ message: 'new row violates check constraint "x" on table "student_profiles"' })).toBe(genericError)
    expect(friendlyError('AuthApiError: something odd at supabase.co')).toBe(genericError)
  })
})
