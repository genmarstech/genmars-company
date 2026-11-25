import { useState, type FormEvent } from 'react'
import { budgetRanges, CONTACT_EMAIL, services } from '../data/site'
import { Icon } from './Icon'
import './ContactSection.css'

type Errors = Partial<Record<'name' | 'email' | 'message', string>>

export function ContactSection() {
  const [errors, setErrors] = useState<Errors>({})
  const [sent, setSent] = useState(false)

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const get = (k: string) => String(data.get(k) ?? '').trim()
    const brief = {
      name: get('name'),
      email: get('email'),
      phone: get('phone'),
      service: get('service'),
      budget: get('budget'),
      message: get('message'),
    }

    const next: Errors = {}
    if (!brief.name) next.name = 'Please tell us your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brief.email)) next.email = 'Please enter a valid email address.'
    if (brief.message.length < 10) next.message = 'A sentence or two about the project helps us reply properly.'
    setErrors(next)
    if (Object.keys(next).length) return

    // Until the enquiries API is live, hand the brief to the visitor's email app.
    const body = [
      `Name: ${brief.name}`,
      `Email: ${brief.email}`,
      brief.phone && `Phone: ${brief.phone}`,
      `Service: ${brief.service}`,
      `Budget: ${brief.budget}`,
      '',
      brief.message,
    ]
      .filter((line) => line !== '')
      .join('\n')
    const subject = `Project brief: ${brief.service} (${brief.name})`
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  return (
    <section id="contact" className="wrap cs">
      <div className="cs-panel">
        <div className="cs-intro">
          <span className="eyebrow">Let’s work together</span>
          <h2 className="cs-title">
            Have a project <span className="serif">in mind?</span>
          </h2>
          <p className="muted cs-copy">
            Tell us what you’re building. We reply within one business day with next steps and a time for a free
            consultation call.
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
            <span>
              <Icon name="pin" strokeWidth={1.8} />
              Nairobi, Kenya · working with teams worldwide
            </span>
          </div>
        </div>

        {sent ? (
          <div className="cs-sent" role="status">
            <span className="cs-sent-icon">
              <Icon name="check" size={22} strokeWidth={2.4} />
            </span>
            <h3>Your brief is ready to send</h3>
            <p className="muted">
              We’ve opened it in your email app. If nothing opened, email us directly at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
            <button type="button" className="btn btn--ghost" onClick={() => setSent(false)}>
              Edit my brief
            </button>
          </div>
        ) : (
          <form className="cs-form" noValidate onSubmit={onSubmit}>
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
              <select name="service" defaultValue={services[0].short}>
                {services.map((s) => (
                  <option key={s.slug}>{s.short}</option>
                ))}
                <option>Something else</option>
              </select>
            </label>
            <label className="field">
              Budget
              <select name="budget" defaultValue={budgetRanges[budgetRanges.length - 1]}>
                {budgetRanges.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="field cs-full">
              Phone or WhatsApp <span className="cs-optional">(optional)</span>
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
            <button type="submit" className="btn cs-full">
              Send project brief
              <Icon name="arrow" size={18} />
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
