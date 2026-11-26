import { useState, type FormEvent } from 'react'
import { TEAM_URL } from './meetingTypes'
import { navigate } from './router'
import { ApiError, login } from './session'
import { LogoMark } from './ui/Icon'

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
    </main>
  )
}
