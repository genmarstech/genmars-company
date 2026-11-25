import { useState } from 'react'
import { ContactSection } from '../components/ContactSection'
import { Icon } from '../components/Icon'
import { formatKes, services } from '../data/site'
import { Link } from '../components/Link'
import './Services.css'

const models = [
  {
    name: 'Fixed-scope project',
    text: 'A defined product, one agreed price, paid by milestone. Best for new builds.',
    points: ['Price agreed upfront', '30% deposit, then milestones', 'Weekly demos'],
    price: `From ${formatKes(10_000)}`,
  },
  {
    name: 'Maintenance plan',
    text: 'Updates, backups, monitoring and small improvements every month after launch.',
    points: ['Priority support', 'Security updates & backups', 'Monthly report'],
    price: `From ${formatKes(5_000)} / month`,
    popular: true,
  },
  {
    name: 'Dedicated team',
    text: 'A Genmars designer and engineers working as part of your team.',
    points: ['Your roadmap, our people', 'Daily stand-ups', 'Scale up or down monthly'],
    price: 'Quoted per team',
  },
]

const faq = [
  [
    'How much does a project cost?',
    'Each service has a clear starting price. After a free discovery call we send a fixed-scope proposal with one price, so there are no surprise bills.',
  ],
  [
    'How do payments work?',
    'Usually a 30% deposit, then payments at agreed milestones. You can pay by M-Pesa, bank transfer or card, with eTIMS-compliant invoices.',
  ],
  ['Who owns the code?', 'You do. On final payment you receive the full source code, documentation and all accounts.'],
  [
    'Do you support software after launch?',
    'Yes. Every project includes a support period, and you can continue with a maintenance plan from KES 5,000 a month.',
  ],
  ['Can you work with our existing system?', 'Yes. We regularly extend, integrate with or gradually replace existing software.'],
]

export function Services() {
  const [open, setOpen] = useState(0)

  return (
    <>
      <section className="wrap sv-hero">
        <span className="eyebrow">Services &amp; prices</span>
        <h1 className="sv-title">What we do, what it costs, and how long it takes.</h1>
        <p className="lead sv-lead">
          Prices are starting points in Kenyan shillings. After a free first conversation you get a written quote with
          one fixed price.
        </p>
      </section>

      <section className="wrap sv-list" aria-label="Services">
        {services.map((s) => (
          <article key={s.slug} id={s.slug} className="sv-row">
            <div className="sv-main">
              <h2>{s.title}</h2>
              <p className="muted">{s.desc}</p>
            </div>
            <ul className="tick">
              {s.includes.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <div className="sv-facts">
              <span className="label">Typical timeline</span>
              <span className="sv-fact">{s.timeline}</span>
              <span className="label sv-facts-gap">Starts from</span>
              <span className="sv-fact">
                {s.from === null ? 'Quoted per project' : formatKes(s.from)}
                {s.per && <span className="sv-per"> / {s.per}</span>}
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="sv-models-wrap">
        <div className="wrap sv-models-inner">
          <div className="sv-head">
            <span className="eyebrow">Ways to work with us</span>
            <h2 className="h2">A one-off project, or ongoing help.</h2>
          </div>
          <div className="sv-models">
            {models.map((m) => (
              <article key={m.name} className={`card sv-model${m.popular ? ' sv-model--popular' : ''}`}>
                <span className="sv-model-name">
                  {m.name}
                  {m.popular && <span className="sv-badge">Recommended</span>}
                </span>
                <p className="muted">{m.text}</p>
                <ul className="tick">
                  {m.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <span className="sv-model-price">{m.price}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="wrap sv-faq">
        <div className="sv-head sv-faq-head">
          <span className="eyebrow">Questions</span>
          <h2 className="h2">Common questions.</h2>
        </div>
        <div className="sv-faq-list">
          {faq.map(([q, a], i) => {
            const isOpen = i === open
            return (
              <div key={q} className="sv-faq-item">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    {q}
                    <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                  </button>
                </h3>
                <p id={`faq-${i}`} className="muted" hidden={!isOpen}>
                  {a}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="wrap sv-cta-wrap">
        <div className="card sv-cta">
          <h2 className="h2">Not sure which fits? Ask us.</h2>
          <Link to="/services#contact" className="btn btn--lg">
            Get a free quote <Icon name="arrow" />
          </Link>
        </div>
      </section>

      <ContactSection />
    </>
  )
}
