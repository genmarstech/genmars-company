import { ContactSection } from '../components/ContactSection'
import { HeroTiles } from '../components/HeroTiles'
import { Icon } from '../components/Icon'
import { priceLabel, services } from '../data/site'
import { Link } from '../components/Link'
import './Home.css'

const outcomes = [
  { tone: 'signal', icon: 'card', title: 'Get paid on time', text: 'M-Pesa and invoices, handled automatically' },
  { tone: 'ice', icon: 'doc', title: 'Less paperwork', text: 'Replace spreadsheets and endless WhatsApp threads' },
  { tone: 'amber', icon: 'eye', title: 'See it all at once', text: 'Sales, stock and staff on one screen' },
] as const

const outcomeIcons = {
  card: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13l2 2 4-4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
}

const builds = ['Websites', 'Online shops', 'Booking systems', 'Customer portals', 'Staff & payroll tools', 'Mobile apps']
const sectors = ['Shops & retail', 'Clinics', 'Schools', 'SACCOs', 'Logistics', 'Hotels & salons', 'Startups']

const steps = [
  { title: 'Discover', text: 'A working session to map your goals, users and constraints.', get: 'a fixed-scope proposal' },
  { title: 'Design', text: 'Flows and high-fidelity screens you can click through before we write code.', get: 'an approved prototype' },
  { title: 'Build', text: 'Short sprints with a live demo every week and a shared progress dashboard.', get: 'working software, weekly' },
  { title: 'Launch & care', text: 'Deployment, training and monitoring, then support as you grow.', get: 'a system that keeps running' },
]

const principles = [
  { title: 'Built for Kenyan business', text: 'M-Pesa, KRA eTIMS and local banking are first-class, not afterthoughts.' },
  { title: 'Transparent by default', text: 'Fixed scopes, milestone billing and a live client dashboard.' },
  { title: 'Secure from day one', text: 'Data Protection Act-aware architecture, encrypted data and audited access.' },
  { title: 'Yours to keep', text: 'Full source code, documentation and handover, with no lock-in.' },
]

const labs = [
  { name: 'Genmars Commerce', text: 'Multi-tenant e-commerce for Kenyan merchants, with M-Pesa checkout built in.' },
  { name: 'Genmars KYC', text: 'Secure identity verification and onboarding for fintechs and SACCOs.' },
  { name: 'Velora', text: 'Bookings, staff and payments for salons and spas, in one calm app.' },
]

export function Home() {
  const [featured, ...rest] = services

  return (
    <>
      <div className="hm-grid" aria-hidden="true" />

      {/* Hero */}
      <section id="top" className="wrap hm-hero">
        <div className="hm-hero-copy">
          <div className="hm-badge">
            <span>NOW BOOKING</span>
            Software studio · Kenya
          </div>
          <h1 className="h1">
            Build smarter.
            <br />
            <span className="serif">Grow faster.</span>
          </h1>
          <p className="lead hm-lead">
            We build the websites, apps and systems that help your business{' '}
            <span className="hm-hl">sell more, save time and get paid faster</span>, designed around how you already
            work. No technical knowledge needed.
          </p>
          <div className="hm-ctas">
            <Link to="/#contact" className="btn btn--lg btn--glow">
              Book a free consultation
              <Icon name="arrow" />
            </Link>
            <Link to="/services" className="btn btn--lg btn--ghost">
              See services &amp; pricing
            </Link>
          </div>
          <ul className="hm-outcomes">
            {outcomes.map((o) => (
              <li key={o.title}>
                <span className="hm-outcome-title">
                  <span className={`hm-outcome-icon hm-tone-${o.tone}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {outcomeIcons[o.icon]}
                    </svg>
                  </span>
                  {o.title}
                </span>
                <span className="hm-outcome-text">{o.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <HeroTiles />
      </section>

      {/* What we build */}
      <section aria-label="What we build" className="hm-strip">
        <div className="wrap hm-strip-inner">
          <div className="hm-strip-row">
            <span className="label hm-strip-label">We build</span>
            <div className="hm-builds">
              {builds.map((b) => (
                <span key={b}>{b}</span>
              ))}
            </div>
          </div>
          <div className="hm-strip-row">
            <span className="label hm-strip-label">For</span>
            <div className="hm-sectors">
              {sectors.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="wrap hm-section hm-services">
        <div className="hm-head hm-head--split">
          <div className="hm-head-main">
            <span className="eyebrow">01 — Services</span>
            <h2 className="h2">
              Everything it takes to go from idea to <span className="serif">production.</span>
            </h2>
          </div>
          <p className="hm-head-aside">
            One senior team across strategy, design, engineering and infrastructure, so nothing gets lost between
            hand-offs. Clear starting prices, fixed quotes.
          </p>
        </div>

        <div className="hm-svc">
          <article className="card card--hover hm-svc-card hm-svc-feature">
            <div className="hm-svc-body">
              <div className="hm-svc-top">
                <span className="hm-svc-icon">
                  <Icon name={featured.icon} size={22} strokeWidth={1.8} />
                </span>
                <span className="hm-svc-n">{featured.n}</span>
              </div>
              <h3 className="hm-svc-title hm-svc-title--lg">{featured.title}</h3>
              <p className="muted">{featured.desc}</p>
              <div className="hm-svc-foot">
                <span className="hm-price">{priceLabel(featured)}</span>
                <Link to="/#contact" className="text-link">
                  Discuss your system <Icon name="arrow" size={16} />
                </Link>
              </div>
            </div>
            <div className="hm-modules" aria-hidden="true">
              <div className="hm-modules-head">
                <span>MODULES</span>
                <span>STATUS</span>
              </div>
              <div className="hm-module">
                <span>Inventory &amp; stock</span>
                <span className="hm-live">Live</span>
              </div>
              <div className="hm-module">
                <span>Payroll &amp; HR</span>
                <span className="hm-live">Live</span>
              </div>
              <div className="hm-module hm-module--active">
                <span>Customer CRM</span>
                <span className="hm-building">Building</span>
              </div>
              <div className="hm-module">
                <span>Reporting</span>
                <span className="hm-planned">Planned</span>
              </div>
            </div>
          </article>

          {rest.map((s) => (
            <article key={s.slug} className="card card--hover hm-svc-card">
              <div className="hm-svc-top">
                <span className="hm-svc-icon">
                  <Icon name={s.icon} size={22} strokeWidth={1.8} />
                </span>
                <span className="hm-svc-n">{s.n}</span>
              </div>
              <h3 className="hm-svc-title">{s.title}</h3>
              <p className="muted">{s.desc}</p>
              <span className="hm-price">{priceLabel(s)}</span>
            </article>
          ))}

          <article className="hm-svc-card hm-svc-cta">
            <h3 className="hm-svc-title">Not sure which you need?</h3>
            <p>
              Tell us the problem and we’ll recommend the right fit, with a fixed quote before any work starts.
            </p>
            <div className="hm-svc-cta-links">
              <Link to="/#contact" className="btn btn--sm">
                Get a free quote <Icon name="arrow" size={16} />
              </Link>
              <Link to="/services" className="text-link">
                Compare all services
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="wrap hm-section">
        <div className="hm-head">
          <span className="eyebrow">02 — Process</span>
          <h2 className="h2">
            A clear path, <span className="serif">no surprises.</span>
          </h2>
        </div>
        <ol className="hm-steps">
          {steps.map((s, i) => (
            <li key={s.title} className={i === 0 ? 'hm-step hm-step--first' : 'hm-step'}>
              <span className="hm-step-n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p className="muted">{s.text}</p>
              <span className="hm-step-get">You get: {s.get}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Why Genmars */}
      <section id="about" className="hm-about">
        <div className="wrap hm-about-inner">
          <div className="hm-about-quote">
            <span className="eyebrow">Why Genmars</span>
            <p>“A focused studio means the people who scope your project are the people who build it.”</p>
          </div>
          <ul className="hm-principles">
            {principles.map((p, i) => (
              <li key={p.title}>
                <span className="hm-principle-key">{String.fromCharCode(65 + i)}</span>
                <span>
                  <strong>{p.title}</strong>
                  <span className="muted">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Labs */}
      <section id="labs" className="wrap hm-section">
        <div className="hm-head hm-head--split">
          <div className="hm-head-main">
            <span className="eyebrow">03 — Genmars Labs</span>
            <h2 className="h2">
              Products in the <span className="serif">workshop.</span>
            </h2>
          </div>
          <Link to="/#contact" className="btn btn--sm btn--ghost">
            Join the early-access list
          </Link>
        </div>
        <div className="hm-labs">
          {labs.map((l) => (
            <article key={l.name} className="card card--hover hm-lab">
              <div className="hm-lab-top">
                <span className="hm-lab-name">{l.name}</span>
                <span className="hm-lab-tag">In development</span>
              </div>
              <p className="muted">{l.text}</p>
            </article>
          ))}
        </div>
      </section>

      <ContactSection />
    </>
  )
}
