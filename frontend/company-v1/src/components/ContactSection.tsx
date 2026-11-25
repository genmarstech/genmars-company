import { useState, type FormEvent } from 'react'
import { apiFetch } from '../api'
import { budgetRanges, company, CONTACT_EMAIL, services } from '../data/site'
import { Icon } from './Icon'
import './ContactSection.css'

type Field = 'name' | 'email' | 'message'
type Errors = Partial<Record<Field | 'form', string>>

// Django field names → form field names
const apiFields: Record<string, Field> = { full_name: 'name', email: 'email', message: 'message' }

export function ContactSection({ variant = 'section' }: { variant?: 'section' | 'page' }) {
  const isPage = variant === 'page'
  const [errors, setErrors] = useState<Errors>({})
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const get = (k: string) => String(data.get(k) ?? '').trim()
    const brief = {
      full_name: get('name'),
      email: get('email'),
      phone_number: get('phone'),
      service: get('service'),
      budget: get('budget'),
      message: get('message'),
      website: get('website'),
    }

    const next: Errors = {}
    if (!brief.full_name) next.name = 'Please tell us your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brief.email)) next.email = 'Please enter a valid email address.'
    if (brief.message.length < 10) next.message = 'A sentence or two about the project helps us reply properly.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSending(true)
    try {
      const res = await apiFetch('/api/v1/enquiries/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief),
      })
      if (res.ok) {
        form.reset()
        setSentTo(brief.email)
        return
      }
      if (res.status === 400) {
        const body: Record<string, string[]> = await res.json().catch(() => ({}))
        const fieldErrors: Errors = {}
        for (const [key, msgs] of Object.entries(body)) {
          const field = apiFields[key]
          if (field) fieldErrors[field] = msgs[0]
        }
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: 'Please check the form and try again.' })
      } else if (res.status === 429) {
        setErrors({ form: `You’ve sent a few briefs already. Please email us at ${CONTACT_EMAIL} instead.` })
      } else {
        throw new Error(String(res.status))
      }
    } catch {
      setErrors({ form: `We couldn’t send your brief just now. Please try again or email ${CONTACT_EMAIL}.` })
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="contact" className={`wrap cs${isPage ? ' cs--page' : ''}`}>
      <div className="cs-panel">
        <div className="cs-intro">
          <span className="eyebrow eyebrow--line">{isPage ? 'Contact us' : 'Get a quote'}</span>
          {isPage ? (
            <h1 className="cs-title">Let’s build something great together.</h1>
          ) : (
            <h2 className="cs-title">Tell us about your project.</h2>
          )}
          <p className="muted cs-copy">
            Have a project in mind? A few lines is enough. We reply within one working day, usually with a couple of
            questions and a time for a free call.
          </p>
          <ul className="cs-promise">
            <li>
              <Icon name="check" size={16} /> Fixed quote before any work starts
            </li>
            <li>
              <Icon name="check" size={16} /> Pay in milestones by M-Pesa or bank
            </li>
            <li>
              <Icon name="check" size={16} /> You own the code and the accounts
            </li>
          </ul>
          <div className="cs-contacts">
            <a href={`mailto:${CONTACT_EMAIL}`}>
              <Icon name="mail" strokeWidth={1.8} />
              {CONTACT_EMAIL}
            </a>
            {company.phone && (
              <a href={`tel:${company.phone}`}>
                <Icon name="phone" strokeWidth={1.8} />
                {company.phone}
              </a>
            )}
            <span>
              <Icon name="pin" strokeWidth={1.8} />
              {[company.address, company.city].filter(Boolean).join(', ')}
            </span>
            {company.hours && (
              <span>
                <Icon name="clock" strokeWidth={1.8} />
                {company.hours}
              </span>
            )}
          </div>
          {isPage && (
            <div className="cs-photo">
              <img src="/building-2.jpg" alt="Glass office towers reflecting a blue sky" width={1400} height={1050} />
            </div>
          )}
        </div>

        {sentTo ? (
          <div className="cs-sent" role="status">
            <span className="cs-sent-icon">
              <Icon name="check" size={22} strokeWidth={2.4} />
            </span>
            <h3>Thanks, your brief is in</h3>
            <p className="muted">
              We’ve sent a confirmation to <strong>{sentTo}</strong> and will reply within one business day with next
              steps and a time for your free consultation.
            </p>
            <button type="button" className="btn btn--ghost" onClick={() => setSentTo(null)}>
              Send another brief
            </button>
          </div>
        ) : (
          <form className="cs-form" noValidate onSubmit={onSubmit} aria-labelledby="quote-form-title">
            <h2 id="quote-form-title" className="cs-form-title">
              Request a project quote
            </h2>
            <label className="field" data-invalid={!!errors.name}>
              Full name
              <input name="name" type="text" autoComplete="name" placeholder="Jane Wanjiru" aria-invalid={!!errors.name} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </label>
            <label className="field" data-invalid={!!errors.email}>
              Work email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="jane@company.co.ke"
                aria-invalid={!!errors.email}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </label>
            <label className="field">
              Service
              <select name="service" defaultValue={services[0].apiValue}>
                {services.map((s) => (
                  <option key={s.slug} value={s.apiValue}>
                    {s.short}
                  </option>
                ))}
                <option value="other">Something else</option>
              </select>
            </label>
            <label className="field">
              Budget
              <select name="budget" defaultValue="unsure">
                {budgetRanges.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field cs-full">
              <span>
                Phone or WhatsApp <span className="cs-optional">(optional)</span>
              </span>
              <input name="phone" type="tel" autoComplete="tel" placeholder="+254 7XX XXX XXX" />
            </label>
            <label className="field cs-full" data-invalid={!!errors.message}>
              About the project
              <textarea
                name="message"
                rows={4}
                placeholder="What are you building, and by when?"
                aria-invalid={!!errors.message}
              />
              {errors.message && <span className="field-error">{errors.message}</span>}
            </label>
            {/* Honeypot: hidden from people, filled in by spam bots */}
            <input name="website" type="text" tabIndex={-1} autoComplete="off" className="cs-hp" aria-hidden="true" />
            {errors.form && (
              <p className="field-error cs-full" role="alert">
                {errors.form}
              </p>
            )}
            <button type="submit" className="btn cs-full" disabled={sending}>
              {sending ? 'Sending…' : 'Send project brief'}
              {!sending && <Icon name="arrow" size={18} />}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
