import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import './HowWeWork.css'

const steps = [
  {
    icon: 'search',
    title: 'Discover',
    short: 'Understand your needs and goals.',
    detail: 'A free call or meeting about your business, your customers and what is slowing you down.',
    get: 'A clear summary of what you need',
  },
  {
    icon: 'layout',
    title: 'Plan',
    short: 'Design the right solution.',
    detail: 'We map the screens and features, then send a written scope, timeline and one fixed price.',
    get: 'A fixed quote and a clickable design',
  },
  {
    icon: 'code',
    title: 'Build',
    short: 'Develop with quality and care.',
    detail: 'Short build cycles with a working preview every week, so you see progress and give feedback early.',
    get: 'Working software, every week',
  },
  {
    icon: 'rocket',
    title: 'Launch',
    short: 'Deploy and support.',
    detail: 'We go live, train your team and stay on call. Ongoing support is available on a monthly plan.',
    get: 'A live system and a team to call',
  },
] as const

const promises = [
  { title: 'Fixed price', text: 'Agreed in writing before any work starts. Changes are quoted before they happen.' },
  { title: 'Pay in stages', text: 'A deposit to begin, then milestones. M-Pesa, bank transfer or card.' },
  { title: 'Weekly updates', text: 'A short update and a preview link every week, so there are no surprises.' },
  { title: 'You own it', text: 'Code, domain, hosting and data are in your name from day one.' },
]

export function HowWeWork() {
  return (
    <>
      <section className="wrap hw-hero">
        <div className="hw-copy">
          <span className="eyebrow eyebrow--line">Our process</span>
          <h1 className="hw-title">A simple, transparent process.</h1>
          <p className="lead">From idea to launch, we keep you informed at every step.</p>
          <div className="hw-photo">
            <img src="/building.jpg" alt="Modern glass office building against a blue sky" width={1400} height={1050} />
          </div>
        </div>

        <ol className="hw-steps">
          {steps.map((s, i) => (
            <li key={s.title} className="hw-step">
              <span className="hw-step-icon">
                <Icon name={s.icon} size={22} strokeWidth={1.8} />
              </span>
              <div className="hw-step-body">
                <h2>
                  {i + 1}. {s.title}
                </h2>
                <p className="hw-step-short">{s.short}</p>
                <p className="muted">{s.detail}</p>
                <span className="hw-step-get">
                  <Icon name="check" size={15} /> {s.get}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="hw-promises">
        <div className="wrap hw-promises-inner">
          <h2 className="h2">What you can count on</h2>
          <div className="hw-promise-grid">
            {promises.map((p) => (
              <article key={p.title} className="card hw-promise">
                <h3>{p.title}</h3>
                <p className="muted">{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap hw-cta">
        <h2 className="h2">Ready to start with a free call?</h2>
        <div className="hw-cta-actions">
          <Link to="/contact" className="btn btn--lg">
            Request a quote <Icon name="arrow" />
          </Link>
          <Link to="/services" className="btn btn--lg btn--ghost">
            See services &amp; prices
          </Link>
        </div>
      </section>
    </>
  )
}
