import { useState, type FormEvent } from 'react'
import { apiFetch } from '../api'
import { Icon } from '../components/Icon'
import './Products.css'

const products = [
  {
    name: 'Genmars Commerce',
    tagline: 'Online shops with M-Pesa checkout built in.',
    text: 'A ready-made store for merchants: catalogue, stock, orders, delivery tracking and payments in one place.',
    points: ['M-Pesa, card and bank payments', 'Stock and order tracking', 'Your own domain'],
  },
  {
    name: 'Genmars KYC',
    tagline: 'Identity checks for fintechs and SACCOs.',
    text: 'Secure onboarding that verifies customers’ documents and details, with an audit trail your compliance team can trust.',
    points: ['Document and selfie checks', 'Risk flags and review queue', 'Data Protection Act aware'],
  },
  {
    name: 'Velora',
    tagline: 'Bookings, staff and payments for salons and spas.',
    text: 'Clients book online and get reminders; you see your day, your team’s schedule and takings at a glance.',
    points: ['Online booking and reminders', 'Staff schedules and commissions', 'Takings by day and stylist'],
  },
]

export function Products() {
  return (
    <>
      <section className="wrap pr-hero">
        <span className="eyebrow eyebrow--line">Genmars Labs</span>
        <h1 className="pr-title">Products we’re building.</h1>
        <p className="lead pr-lead">
          Alongside client work, we’re building our own products for problems we see again and again. Join the early-access
          list and we’ll let you know when each one opens.
        </p>
      </section>

      <section className="wrap pr-grid" aria-label="Products">
        {products.map((p) => (
          <article key={p.name} className="card pr-card">
            <div className="pr-card-top">
              <h2>{p.name}</h2>
              <span className="pr-tag">In development</span>
            </div>
            <p className="pr-tagline">{p.tagline}</p>
            <p className="muted">{p.text}</p>
            <ul className="tick">
              {p.points.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <EarlyAccess product={p.name} />
          </article>
        ))}
      </section>
    </>
  )
}

function EarlyAccess({ product }: { product: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setState('error')
    setState('busy')
    try {
      const res = await apiFetch('/api/v1/enquiries/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: email.split('@')[0],
          email,
          service: 'other',
          budget: 'unsure',
          source: 'early_access',
          message: `Early access request for ${product}.`,
        }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <p className="pr-done" role="status">
        <Icon name="check" size={16} strokeWidth={2.4} /> You’re on the list. We’ll email you when {product} opens.
      </p>
    )
  }
  return (
    <form className="pr-form" onSubmit={submit} noValidate>
      <label className="sr-only" htmlFor={`ea-${product}`}>
        Email for {product} early access
      </label>
      <input id={`ea-${product}`} name="email" type="email" autoComplete="email" placeholder="you@company.com" aria-invalid={state === 'error'} />
      <button type="submit" className="btn btn--sm" disabled={state === 'busy'}>
        {state === 'busy' ? 'Joining…' : 'Get early access'}
      </button>
      {state === 'error' && <span className="field-error">Enter a valid email, or try again in a moment.</span>}
    </form>
  )
}
