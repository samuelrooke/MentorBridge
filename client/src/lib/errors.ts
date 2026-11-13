// Turns technical auth and database errors into plain sentences, so users never
// see messages like "AuthApiError" or "violates row-level security policy".
const known: [RegExp, string][] = [
  [/invalid login credentials/i, 'That email and password don’t match. Check them, or reset your password.'],
  [/email not confirmed/i, 'Confirm your email first: click the link we sent you (check your spam folder too).'],
  [/already registered|already been registered|user already exists/i, 'There is already an account with this email. Log in, or reset your password.'],
  [/rate limit|too many|security purposes/i, 'Too many attempts. Wait a few minutes and try again.'],
  [/password should be at least|weak password/i, 'Your password needs at least 8 characters.'],
  [/different from the old/i, 'Choose a password that is different from your old one.'],
  [/invalid email|unable to validate email/i, 'Check your email address. It doesn’t look right.'],
  [/expired|invalid.*(token|otp|link)|(token|otp|link).*invalid/i, 'This link has expired or was already used. Ask for a new one.'],
  [/failed to fetch|network|load failed/i, 'We can’t reach MentorBridge right now. Check your internet connection and try again.'],
  [/row-level security|permission denied|not authorized/i, 'You don’t have access to do that.'],
  [/jwt|session.*(missing|expired)|not logged in/i, 'Your session has ended. Log in again.'],
]

export const genericError = 'Something went wrong. Try again in a minute.'

export function friendlyError(error: unknown): string {
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : (error as { message?: string } | null)?.message ?? ''
  for (const [pattern, text] of known) if (pattern.test(message)) return text
  return genericError
}
