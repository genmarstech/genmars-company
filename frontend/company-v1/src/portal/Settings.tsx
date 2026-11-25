import { useState, type FormEvent } from 'react'
import { ApiError, postJson, refreshUser, useSession, type FieldErrors } from '../auth/session'
import { FormMessage } from '../auth/fields'
import { Panel, PortalLayout } from './PortalLayout'
import { useApi } from './useApi'

type Profile = { company_name: string; job_title: string; industry: string; website: string }

function useForm() {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true)
    setErrors({})
    setNotice(null)
    try {
      await action()
      setNotice({ tone: 'ok', text: ok })
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields)
        setNotice({ tone: 'error', text: e.message || 'Please check the highlighted fields.' })
      }
    } finally {
      setBusy(false)
    }
  }
  return { busy, errors, notice, run }
}

export function Settings() {
  const { user } = useSession()
  const profile = useApi<Profile>('/api/v1/auth/users/me/profile/')
  const account = useForm()
  const business = useForm()
  const password = useForm()

  if (!user) return null

  const saveAccount = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    account.run(async () => {
      await postJson('/api/v1/auth/users/me/', { full_name: data.get('full_name'), phone_number: data.get('phone_number') }, 'PATCH')
      await refreshUser()
    }, 'Your details are saved.')
  }

  const saveBusiness = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    const site = String(data.website ?? '')
    if (site && !/^https?:\/\//.test(site)) data.website = `https://${site}`
    business.run(() => postJson('/api/v1/auth/users/me/profile/', data, 'PATCH'), 'Business details saved.')
  }

  const changePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    if (data.get('password') !== data.get('confirm')) {
      password.run(async () => {
        throw new ApiError('', { confirm: 'The passwords don’t match.' })
      }, '')
      return
    }
    password.run(async () => {
      await postJson('/api/v1/auth/users/me/', { current_password: data.get('current_password'), password: data.get('password') }, 'PATCH')
      form.reset()
    }, 'Password changed.')
  }

  return (
    <PortalLayout title="Settings" subtitle="Manage your account and business details.">
      <div className="pt-settings">
        <Panel title="Your details">
          <form className="pt-form" onSubmit={saveAccount}>
            {account.notice && <FormMessage tone={account.notice.tone}>{account.notice.text}</FormMessage>}
            <label className="field" data-invalid={!!account.errors.full_name}>
              Full name
              <input name="full_name" defaultValue={user.full_name} autoComplete="name" />
              {account.errors.full_name && <span className="field-error">{account.errors.full_name}</span>}
            </label>
            <label className="field">
              Email
              <input value={user.email} readOnly disabled />
            </label>
            <label className="field" data-invalid={!!account.errors.phone_number}>
              Phone or WhatsApp
              <input name="phone_number" defaultValue={user.phone_number} type="tel" autoComplete="tel" />
              {account.errors.phone_number && <span className="field-error">{account.errors.phone_number}</span>}
            </label>
            <button type="submit" className="btn btn--sm" disabled={account.busy}>
              {account.busy ? 'Saving…' : 'Save details'}
            </button>
          </form>
        </Panel>

        <Panel title="Business">
          {profile.data && (
            <form className="pt-form" onSubmit={saveBusiness}>
              {business.notice && <FormMessage tone={business.notice.tone}>{business.notice.text}</FormMessage>}
              <label className="field">
                Company or business name
                <input name="company_name" defaultValue={profile.data.company_name} autoComplete="organization" />
              </label>
              <label className="field">
                Your role
                <input name="job_title" defaultValue={profile.data.job_title} />
              </label>
              <label className="field">
                Industry
                <input name="industry" defaultValue={profile.data.industry} />
              </label>
              <label className="field" data-invalid={!!business.errors.website}>
                Website
                <input name="website" defaultValue={profile.data.website} type="url" />
                {business.errors.website && <span className="field-error">{business.errors.website}</span>}
              </label>
              <button type="submit" className="btn btn--sm" disabled={business.busy}>
                {business.busy ? 'Saving…' : 'Save business details'}
              </button>
            </form>
          )}
        </Panel>

        <Panel title="Change password">
          <form className="pt-form" onSubmit={changePassword}>
            {password.notice && password.notice.text && <FormMessage tone={password.notice.tone}>{password.notice.text}</FormMessage>}
            <label className="field" data-invalid={!!password.errors.current_password}>
              Current password
              <input name="current_password" type="password" autoComplete="current-password" required />
              {password.errors.current_password && <span className="field-error">{password.errors.current_password}</span>}
            </label>
            <label className="field" data-invalid={!!password.errors.password}>
              New password
              <input name="password" type="password" autoComplete="new-password" minLength={8} required />
              {password.errors.password && <span className="field-error">{password.errors.password}</span>}
            </label>
            <label className="field" data-invalid={!!password.errors.confirm}>
              Confirm new password
              <input name="confirm" type="password" autoComplete="new-password" required />
              {password.errors.confirm && <span className="field-error">{password.errors.confirm}</span>}
            </label>
            <button type="submit" className="btn btn--sm" disabled={password.busy}>
              {password.busy ? 'Saving…' : 'Change password'}
            </button>
          </form>
        </Panel>
      </div>
    </PortalLayout>
  )
}
