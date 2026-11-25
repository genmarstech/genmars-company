import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { TrustSections } from '../components/TrustSections'
import './About.css'

const promises = [
  { title: 'Clarity over jargon', text: 'Fixed scopes, plain-language updates and a client portal you can check any time.' },
  { title: 'Craft that lasts', text: 'Clean, tested and documented code, so your software keeps working as you grow.' },
  { title: 'Built for how you sell', text: 'M-Pesa, card payments, SMS and tax invoicing are part of the plan from day one.' },
  { title: 'Yours, fully', text: 'You own the code, the data and the accounts. No lock-in, ever.' },
]

export function About() {
  return (
    <>
      <section className="wrap ab-hero">
        <span className="eyebrow eyebrow--line">About Genmars</span>
        <h1 className="ab-title">We build the software businesses deserve.</h1>
      </section>

      <section className="wrap ab-story">
        <figure className="ab-photo">
          <img src="/services/custom-software.jpg" alt="An engineer working on code across two screens in a Nairobi office" />
        </figure>
        <div className="ab-story-copy">
          <span className="eyebrow">Our story</span>
          <p className="ab-big">Too many good businesses still run on spreadsheets, paper and software built for someone else.</p>
          <p className="muted">
            Genmars Tech exists to change that. We’re a focused team of designers and engineers in Nairobi building custom
            software, websites and automation that fit how a business actually works, with local payments built in from day
            one.
          </p>
          <p className="muted">
            We keep the team small on purpose. The people who scope your project are the people who build it, and they stay
            with you after launch.
          </p>
        </div>
      </section>

      <section className="ab-values">
        <div className="wrap ab-values-inner">
          <div className="ab-head">
            <span className="eyebrow">What we believe</span>
            <h2 className="h2">Four promises.</h2>
          </div>
          <div className="ab-grid">
            {promises.map((p, i) => (
              <article key={p.title} className="card ab-value">
                <span className="ab-n">0{i + 1}</span>
                <h3>{p.title}</h3>
                <p className="muted">{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <TrustSections />

      <section className="wrap ab-cta-wrap">
        <div className="card ab-cta">
          <h2 className="h2">Let’s build something together.</h2>
          <Link to="/contact" className="btn btn--lg">
            Start a project <Icon name="arrow" />
          </Link>
        </div>
      </section>
    </>
  )
}
