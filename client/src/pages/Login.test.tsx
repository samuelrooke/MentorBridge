import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthContext, type AuthState } from '../context/auth'
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
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument()
  })

  it('switches to sign up and asks for a name and role', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: 'Create account', pressed: false }))
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText(/Student preparing/)).toBeChecked()
  })

  it('opens on the sign-up tab with ?mode=signup', () => {
    renderLogin('/login?mode=signup')
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
  })
})
