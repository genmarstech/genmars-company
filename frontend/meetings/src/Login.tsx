import { useEffect, useRef, useState, type FormEvent } from 'react'
import { TEAM_URL } from './meetingTypes'
import { navigate } from './router'
import { ApiError, finishGoogleSignIn, login, startGoogleSignIn } from './session'
import { LogoMark } from './ui/Icon'
import { LegalFooter } from './Legal'

export function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      await login(String(data.get('email') ?? '').trim(), String(data.get('password') ?? ''))
      const next = new URLSearchParams(window.location.search).get('next')
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : 'Check your email and password.')
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setBusy(true)
    setError('')
    try {
      await startGoogleSignIn(new URLSearchParams(window.location.search).get('next') ?? '')
    } catch (err) {
      setError(err instanceof ApiError && err.message ? err.message : 'Couldn’t reach Google. Please try again.')
      setBusy(false)
    }
  }

  return (
    <main className="ml-login">
      <form className="pt-panel ml-login-card" onSubmit={submit}>
        <span className="ml-brand">
          <LogoMark size={36} />
          <span className="ml-word">
            GENMARS <span>Meetings</span>
          </span>
        </span>
        <h1>Sign in</h1>
        <p className="pt-muted">Use your Genmars team account, the same one as the team dashboard.</p>
        {error && <p className="pt-error" role="alert">{error}</p>}
        <button type="button" className="ml-google" disabled={busy} onClick={google}>
          <GoogleG /> Continue with Google
        </button>
        <span className="ml-or">or use your password</span>
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="email" required autoFocus />
        </label>
        <label className="field">
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <a href={`${TEAM_URL}/forgot-password`} className="pt-small ml-forgot">Forgot your password?</a>
      </form>
      <LegalFooter />
    </main>
  )
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Google brings people back here after "Continue with Google". */
export function GoogleReturn() {
  const [error, setError] = useState('')
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return // the nonce can only be used once
    done.current = true
    const fragment = window.location.hash
    // keep the token out of the address bar and history
    window.history.replaceState({}, '', '/auth/google')
    finishGoogleSignIn(fragment)
      .then((next) => navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/'))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Google sign-in didn’t work. Please try again.'))
  }, [])

  return (
    <main className="ml-login">
      <div className="pt-panel ml-login-card">
        <span className="ml-brand">
          <LogoMark size={36} />
          <span className="ml-word">
            GENMARS <span>Meetings</span>
          </span>
        </span>
        <h1>{error ? 'Couldn’t sign you in' : 'Signing you in…'}</h1>
        {error ? (
          <>
            <p className="pt-error" role="alert">{error}</p>
            <a href="/login" className="btn">Back to sign in</a>
          </>
        ) : (
          <p className="pt-muted">One moment while we finish with Google.</p>
        )}
      </div>
      <LegalFooter />
    </main>
  )
}
