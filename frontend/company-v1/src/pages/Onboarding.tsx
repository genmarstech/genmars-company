import { useEffect, useState, type FormEvent } from 'react'
import { authFetch, markOnboarded, postJson, ApiError, useSession, type FieldErrors } from '../auth/session'
import { FormMessage } from '../auth/fields'
import { Icon, LogoMark } from '../components/Icon'
import { Link } from '../components/Link'
import { ServiceArt } from '../components/ServiceArt'
import { budgetRanges, services } from '../data/site'
import { navigate } from '../router'
import './Onboarding.css'

type Profile = {
  company_name: string
  job_title: string
  industry: string
  company_size: string
  website: string
  phone_number: string
  services: string[]
  budget: string
  timeline: string
  contact_method: string
  goals: string
}

const EMPTY: Profile = {
  company_name: '',
  job_title: '',
  industry: '',
  company_size: '',
  website: '',
  phone_number: '',
  services: [],
  budget: '',
  timeline: '',
  contact_method: 'email',
  goals: '',
}

const STEPS = ['Welcome', 'Profile', 'Preferences', 'Complete']
const SIZES = [
  { value: 'solo', label: 'Just me' },
  { value: '2_10', label: '2–10' },
  { value: '11_50', label: '11–50' },
  { value: '51_plus', label: '51+' },
]
const TIMELINES = ['As soon as possible', 'In 1–3 months', 'In 3–6 months', 'Just exploring']
const CONTACT = [
  { value: 'email', label: 'Email', by: 'email' },
  { value: 'phone', label: 'Phone call', by: 'phone' },
  { value: 'whatsapp', label: 'WhatsApp', by: 'WhatsApp' },
]
const PROFILE_URL = '/api/v1/auth/users/me/profile/'

function Chips({
  options,
  value,
  onChange,
  multiple = false,
  label,
}: {
  options: { value: string; label: string }[]
  value: string | string[]
  onChange: (v: string | string[]) => void
  multiple?: boolean
  label: string
}) {
  const selected = (v: string) => (multiple ? (value as string[]).includes(v) : value === v)
  const toggle = (v: string) => {
    if (!multiple) return onChange(v)
    const list = value as string[]
    onChange(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  }
  return (
    <div className="ob-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="ob-chip"
          aria-pressed={selected(o.value)}
          onClick={() => toggle(o.value)}
        >
          {selected(o.value) && <Icon name="check" size={14} strokeWidth={2.4} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Onboarding() {
  const { user } = useSession()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/login?next=/onboarding')
      return
    }
    // pick up anything saved on an earlier visit
    authFetch(PROFILE_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setProfile((p) => ({ ...p, ...data, phone_number: data.phone_number || user.phone_number })))
      .catch(() => {})
  }, [user])

  if (!user) return null

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((p) => ({ ...p, [key]: value }))

  async function save(fields: Partial<Profile> & { complete?: boolean }, next: number) {
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      await postJson(PROFILE_URL, fields, 'PATCH')
      if (fields.complete) markOnboarded()
      setStep(next)
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields)
        setMessage(error.message || 'Please check the highlighted fields.')
      }
    } finally {
      setBusy(false)
    }
  }

  const submitProfile = (e: FormEvent) => {
    e.preventDefault()
    const { company_name, job_title, industry, company_size, website, phone_number } = profile
    const site = website && !/^https?:\/\//.test(website) ? `https://${website}` : website
    save({ company_name, job_title, industry, company_size, website: site, phone_number }, 2)
  }

  const submitPreferences = (e: FormEvent) => {
    e.preventDefault()
    if (!profile.services.length) {
      setErrors({ services: 'Pick at least one thing you’re interested in.' })
      return
    }
    const { services: chosen, budget, timeline, contact_method, goals } = profile
    save({ services: chosen, budget, timeline, contact_method, goals, complete: true }, 3)
  }

  const firstName = user.full_name.split(' ')[0]

  return (
    <div className="ob">
      <header className="ob-top">
        <Link to="/" className="ob-brand" aria-label="Genmars Tech home">
          <LogoMark size={36} />
          <span>GENMARS</span>
        </Link>
        <ol className="ob-steps" aria-label="Onboarding progress">
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? 'is-done' : i === step ? 'is-current' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="ob-dot">{i < step ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}</span>
              <span className="ob-step-label">{label}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="ob-card">
        {step === 0 && (
          <div className="ob-welcome">
            <div className="ob-welcome-copy">
              <h1>Welcome to Genmars, {firstName}!</h1>
              <p className="lead">
                Let’s set up your workspace and get you started on your project. It takes about two minutes, and you can
                change anything later.
              </p>
              <button type="button" className="btn btn--lg" onClick={() => setStep(1)}>
                Continue <Icon name="arrow" />
              </button>
            </div>
            <div className="ob-welcome-art" aria-hidden="true">
              <ServiceArt slug="custom-software" />
            </div>
          </div>
        )}

        {step === 1 && (
          <form className="ob-form" noValidate onSubmit={submitProfile}>
            <div className="ob-head">
              <h1>About your business</h1>
              <p className="muted">This helps us prepare before we talk.</p>
            </div>
            {message && <FormMessage tone="error">{message}</FormMessage>}
            <div className="ob-grid">
              <label className="field">
                Company or business name
                <input value={profile.company_name} onChange={(e) => set('company_name', e.target.value)} autoComplete="organization" placeholder="Acme Traders Ltd" />
              </label>
              <label className="field">
                Your role
                <input value={profile.job_title} onChange={(e) => set('job_title', e.target.value)} autoComplete="organization-title" placeholder="Owner, Operations manager…" />
              </label>
              <label className="field">
                Industry
                <input value={profile.industry} onChange={(e) => set('industry', e.target.value)} placeholder="Retail, healthcare, logistics…" />
              </label>
              <label className="field" data-invalid={!!errors.phone_number}>
                Phone or WhatsApp
                <input value={profile.phone_number} onChange={(e) => set('phone_number', e.target.value)} type="tel" autoComplete="tel" placeholder="+254 7XX XXX XXX" />
                {errors.phone_number && <span className="field-error">{errors.phone_number}</span>}
              </label>
              <label className="field ob-full" data-invalid={!!errors.website}>
                <span>
                  Current website <span className="ob-optional">(if you have one)</span>
                </span>
                <input value={profile.website} onChange={(e) => set('website', e.target.value)} type="url" autoComplete="url" placeholder="www.yourbusiness.com" />
                {errors.website && <span className="field-error">{errors.website}</span>}
              </label>
              <div className="field ob-full">
                Team size
                <Chips label="Team size" options={SIZES} value={profile.company_size} onChange={(v) => set('company_size', v as string)} />
              </div>
            </div>
            <div className="ob-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Saving…' : 'Continue'} {!busy && <Icon name="arrow" size={18} />}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form className="ob-form" noValidate onSubmit={submitPreferences}>
            <div className="ob-head">
              <h1>What can we help with?</h1>
              <p className="muted">Pick everything that applies. We’ll suggest the simplest place to start.</p>
            </div>
            {message && <FormMessage tone="error">{message}</FormMessage>}
            <div className="field" data-invalid={!!errors.services}>
              Services you’re interested in
              <Chips
                label="Services"
                multiple
                options={services.map((s) => ({ value: s.slug, label: s.title }))}
                value={profile.services}
                onChange={(v) => set('services', v as string[])}
              />
              {errors.services && <span className="field-error">{errors.services}</span>}
            </div>
            <div className="ob-grid">
              <label className="field">
                Budget
                <select value={profile.budget} onChange={(e) => set('budget', e.target.value)}>
                  <option value="">Choose a range</option>
                  {budgetRanges.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                When do you want to start?
                <select value={profile.timeline} onChange={(e) => set('timeline', e.target.value)}>
                  <option value="">Choose one</option>
                  {TIMELINES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field">
              How should we contact you?
              <Chips label="Contact method" options={CONTACT} value={profile.contact_method} onChange={(v) => set('contact_method', v as string)} />
            </div>
            <label className="field">
              <span>
                What would you like to achieve? <span className="ob-optional">(optional)</span>
              </span>
              <textarea value={profile.goals} onChange={(e) => set('goals', e.target.value)} rows={4} placeholder="e.g. Take orders online and get paid by M-Pesa" />
            </label>
            <div className="ob-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Saving…' : 'Finish setup'} {!busy && <Icon name="arrow" size={18} />}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="ob-done">
            <span className="ob-done-icon">
              <Icon name="check" size={28} strokeWidth={2.4} />
            </span>
            <h1>You’re all set, {firstName}!</h1>
            <p className="lead">
              Thanks. Our team has your details and will be in touch by{' '}
              {CONTACT.find((c) => c.value === profile.contact_method)?.by ?? 'email'} within one working
              day to plan your first project.
            </p>
            <div className="ob-actions ob-actions--center">
              <Link to="/portal" className="btn btn--lg">
                Go to my portal <Icon name="arrow" />
              </Link>
              <Link to="/contact" className="btn btn--lg btn--ghost">
                Send a project brief
              </Link>
            </div>
          </div>
        )}
      </div>

      {step < 3 && (
        <button type="button" className="ob-skip" onClick={() => navigate('/portal')}>
          Skip for now
        </button>
      )}
    </div>
  )
}
