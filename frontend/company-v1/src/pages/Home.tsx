import { ContactSection } from '../components/ContactSection'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { ServiceArt } from '../components/ServiceArt'
import { ServiceCard } from '../components/ServiceCard'
import { TrustSections } from '../components/TrustSections'
import { formatKes, services, whatsappLink } from '../data/site'
import './Home.css'

const sectors = ['Shops & retail', 'Clinics', 'Schools', 'SACCOs', 'Logistics', 'Hotels & salons', 'Professional firms']

const steps = [
  {
    title: 'We talk',
    text: 'A free call or meeting to understand your business and what you need. No jargon, no obligation.',
  },
  {
    title: 'You get a fixed quote',
    text: 'A written scope, timeline and one price. Nothing starts until you are happy with it.',
  },
  {
    title: 'We build, you see progress',
    text: 'A short update and a working preview every week, so there are no surprises at the end.',
  },
  {
    title: 'Launch and support',
    text: 'We go live, train your team and stay on call. Support continues on a monthly plan if you want it.',
  },
]

const commitments = [
  {
    title: 'One price, agreed upfront',
    text: 'Your quote is fixed. If the scope changes, we agree the change in writing before doing the work.',
  },
  {
    title: 'Pay in stages',
    text: 'A deposit to start, then payments at agreed milestones. M-Pesa, bank transfer or card.',
  },
  {
    title: 'You own everything',
    text: 'The code, the domain, the hosting accounts and the data are in your name, not ours.',
  },
  {
    title: 'Payments your customers already use',
    text: 'M-Pesa, card payments, SMS, WhatsApp and tax invoicing are part of the plan from day one, not added later.',
  },
]

export function Home() {
  const whatsapp = whatsappLink()
  const priced = services.filter((s) => s.from !== null)

  return (
    <>
      {/* Hero */}
      <section id="top" className="hm-hero">
        <div className="hm-hero-bg" aria-hidden="true" />
        <div className="wrap hm-hero-copy">
          <p className="hm-kicker">Based in Nairobi, working with businesses everywhere</p>
          <h1 className="h1">
            Websites and business software that <span className="serif">just work.</span>
          </h1>
          <p className="lead hm-lead">
            We design, build and look after websites, online shops and custom systems for businesses. M-Pesa
            built in, a fixed price agreed before we start, and a real team to call when you need help.
          </p>
          <div className="hm-ctas">
            <Link to="/#contact" className="btn btn--lg">
              Get a free quote
              <Icon name="arrow" />
            </Link>
            {whatsapp ? (
              <a href={whatsapp} className="btn btn--lg btn--ghost" target="_blank" rel="noopener noreferrer">
                Chat on WhatsApp
              </a>
            ) : (
              <Link to="/services" className="btn btn--lg btn--ghost">
                See services &amp; prices
              </Link>
            )}
          </div>
        </div>
        <p className="hm-photo-credit">
          Nairobi at dusk. Photo:{' '}
          <a href="https://www.pexels.com/photo/stunning-nairobi-skyline-at-dusk-29069329/" target="_blank" rel="noopener noreferrer">
            Ken Mwaura
          </a>
        </p>
      </section>

      {/* Services at a glance */}
      <section className="wrap hm-glance" aria-label="Services and starting prices">
        <ul>
          {priced.map((s) => (
            <li key={s.slug}>
              <Link to={`/services#${s.slug}`} className="hm-glance-card">
                <span className="hm-glance-art">
                  <ServiceArt slug={s.slug} />
                </span>
                <span className="hm-glance-name">{s.title}</span>
                <span className="hm-glance-price">
                  from {formatKes(s.from!)}
                  {s.per && ` / ${s.per}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p>Starting prices. You get a written, fixed quote after a free first conversation.</p>
      </section>

      <div className="theme-light hm-light">
      {/* Who we work with */}
      <section aria-label="Who we work with" className="hm-strip">
        <div className="wrap hm-strip-inner">
          <span className="hm-strip-label">We work with</span>
          <div className="hm-sectors">
            {sectors.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="wrap hm-section">
        <div className="hm-head hm-head--split">
          <div className="hm-head-main">
            <span className="eyebrow">What we do</span>
            <h2 className="h2">Pick what you need. We handle the technical side.</h2>
          </div>
          <p className="hm-head-aside">
            Most clients start with one thing, often a website or an online shop, and add more as the business grows.
          </p>
        </div>

        <div className="hm-svc">
          {services.map((s) => (
            <ServiceCard key={s.slug} service={s} />
          ))}
          <article className="hm-svc-card hm-svc-cta">
            <h3 className="hm-svc-title">Not sure what you need?</h3>
            <p>Tell us the problem in your own words. We’ll recommend the simplest thing that solves it.</p>
            <Link to="/#contact" className="text-link">
              Ask us <Icon name="arrow" size={16} />
            </Link>
          </article>
        </div>
      </section>

      <TrustSections />

      {/* Process */}
      <section id="process" className="wrap hm-section">
        <div className="hm-head">
          <span className="eyebrow">How we work</span>
          <h2 className="h2">Clear steps, from first call to launch.</h2>
          <Link to="/how-we-work" className="text-link">
            See the full process <Icon name="arrow" size={16} />
          </Link>
        </div>
        <ol className="hm-steps">
          {steps.map((s, i) => (
            <li key={s.title} className="hm-step">
              <span className="hm-step-n">Step {i + 1}</span>
              <h3>{s.title}</h3>
              <p className="muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Commitments */}
      <section id="about" className="hm-about">
        <div className="wrap hm-about-inner">
          <div className="hm-about-head">
            <span className="eyebrow">Working with us</span>
            <h2 className="h2">What you can count on.</h2>
            <p className="muted">
              We’re a small team, so you deal directly with the people designing and building your project, from the
              first call to long after launch.
            </p>
          </div>
          <ul className="hm-principles">
            {commitments.map((p) => (
              <li key={p.title}>
                <Icon name="check" size={18} />
                <span>
                  <strong>{p.title}</strong>
                  <span className="muted">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ContactSection />
      </div>
    </>
  )
}
