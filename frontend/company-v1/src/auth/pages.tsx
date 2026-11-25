import { useState, type FormEvent } from 'react'
import { Link } from '../components/Link'
import { navigate } from '../router'
import { AuthLayout } from './AuthLayout'
import { AuthField, FormMessage, SubmitButton } from './fields'
import { ApiError, login, requestPasswordReset, resetPassword, signUp, type FieldErrors, type User } from './session'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formValues(e: FormEvent<HTMLFormElement>) {
  const data = new FormData(e.currentTarget)
  return (k: string) => String(data.get(k) ?? '').trim()
}

/** Where to go after signing in: onboarding first, then the page that sent them here, or their account. */
function nextPath(user: User) {
  if (!user.onboarding_completed) return '/onboarding'
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}

function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')

  async function run(check: () => FieldErrors, action: () => Promise<void>) {
    const local = check()
    setErrors(local)
    setMessage('')
    if (Object.keys(local).length) return
    setBusy(true)
    try {
      await action()
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields)
        setMessage(error.message)
      } else {
        setMessage('Something went wrong. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }
  return { busy, errors, message, run }
}

export function LoginPage() {
  const { busy, errors, message, run } = useSubmit()

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const get = formValues(e)
    const email = get('email')
    const password = get('password')
    run(
      () => ({
        ...(EMAIL_RE.test(email) ? {} : { email: 'Enter the email you signed up with.' }),
        ...(password ? {} : { password: 'Enter your password.' }),
      }),
      async () => {
        navigate(nextPath(await login(email, password)))
      },
    )
  }

  return (
    <AuthLayout
      title="Welcome back!"
      subtitle="Sign in to your account"
      footer={
        <>
          Don’t have an account? <Link to="/signup">Create account</Link>
        </>
      }
    >
      <form className="au-form" noValidate onSubmit={onSubmit}>
        {message && <FormMessage tone="error">{message}</FormMessage>}
        <AuthField label="Email address" name="email" type="email" autoComplete="email" icon="mail" error={errors.email} placeholder="you@company.com" />
        <AuthField label="Password" name="password" type="password" autoComplete="current-password" icon="lock" error={errors.password} />
        <div className="au-row">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <SubmitButton busy={busy}>Sign in</SubmitButton>
      </form>
    </AuthLayout>
  )
}

export function SignUpPage() {
  const { busy, errors, message, run } = useSubmit()

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const get = formValues(e)
    const fullName = get('full_name')
    const email = get('email')
    const password = get('password')
    const confirm = get('confirm')
    run(
      () => ({
        ...(fullName ? {} : { full_name: 'Tell us your name.' }),
        ...(EMAIL_RE.test(email) ? {} : { email: 'Enter a valid email address.' }),
        ...(password.length >= 8 ? {} : { password: 'Use at least 8 characters.' }),
        ...(confirm === password ? {} : { confirm: 'The passwords don’t match.' }),
      }),
      async () => {
        navigate(nextPath(await signUp(fullName, email, password)))
      },
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start building with Genmars today."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="au-form" noValidate onSubmit={onSubmit}>
        {message && <FormMessage tone="error">{message}</FormMessage>}
        <AuthField label="Full name" name="full_name" autoComplete="name" icon="user" error={errors.full_name} placeholder="Jane Wanjiru" />
        <AuthField label="Email address" name="email" type="email" autoComplete="email" icon="mail" error={errors.email} placeholder="you@company.com" />
        <AuthField label="Password" name="password" type="password" autoComplete="new-password" icon="lock" error={errors.password} />
        <AuthField label="Confirm password" name="confirm" type="password" autoComplete="new-password" icon="lock" error={errors.confirm} />
        <SubmitButton busy={busy}>Create account</SubmitButton>
        <p className="au-note">Your details are only used to run your projects with us.</p>
      </form>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const { busy, errors, message, run } = useSubmit()
  const [sent, setSent] = useState('')

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = formValues(e)('email')
    run(
      (): FieldErrors => (EMAIL_RE.test(email) ? {} : { email: 'Enter the email you signed up with.' }),
      async () => {
        const res = await requestPasswordReset(email)
        setSent(res.message)
      },
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="We’ll email you a link to choose a new one."
      footer={
        <>
          Remembered it? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {sent ? (
        <FormMessage tone="ok">{sent}</FormMessage>
      ) : (
        <form className="au-form" noValidate onSubmit={onSubmit}>
          {message && <FormMessage tone="error">{message}</FormMessage>}
          <AuthField label="Email address" name="email" type="email" autoComplete="email" icon="mail" error={errors.email} placeholder="you@company.com" />
          <SubmitButton busy={busy}>Send reset link</SubmitButton>
        </form>
      )}
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const { busy, errors, message, run } = useSubmit()
  const params = new URLSearchParams(window.location.search)
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const get = formValues(e)
    const password = get('password')
    const confirm = get('confirm')
    run(
      () => ({
        ...(password.length >= 8 ? {} : { password: 'Use at least 8 characters.' }),
        ...(confirm === password ? {} : { confirm: 'The passwords don’t match.' }),
      }),
      async () => {
        navigate(nextPath(await resetPassword(uid, token, password)))
      },
    )
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="You’ll be signed in straight after.">
      {!uid || !token ? (
        <FormMessage tone="error">This reset link is incomplete. Please request a new one.</FormMessage>
      ) : (
        <form className="au-form" noValidate onSubmit={onSubmit}>
          {message && <FormMessage tone="error">{message}</FormMessage>}
          <AuthField label="New password" name="password" type="password" autoComplete="new-password" icon="lock" error={errors.password} />
          <AuthField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" icon="lock" error={errors.confirm} />
          <SubmitButton busy={busy}>Save password</SubmitButton>
        </form>
      )}
    </AuthLayout>
  )
}
