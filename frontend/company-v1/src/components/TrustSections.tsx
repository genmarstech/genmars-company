import { caseStudies, clients, team, testimonials } from '../data/site'
import './TrustSections.css'

// Each section renders only when site.ts holds real content for it.

export function TrustSections() {
  return (
    <>
      {clients.length > 0 && (
        <section aria-label="Clients" className="wrap ts-clients">
          <span className="eyebrow">Trusted by</span>
          <ul>
            {clients.map((c) => (
              <li key={c.name}>{c.logo ? <img src={c.logo} alt={c.name} height={32} /> : c.name}</li>
            ))}
          </ul>
        </section>
      )}

      {caseStudies.length > 0 && (
        <section id="work" className="wrap ts-section">
          <div className="ts-head">
            <span className="eyebrow">Our work</span>
            <h2 className="h2">Recent projects.</h2>
          </div>
          <div className="ts-work">
            {caseStudies.map((c) => (
              <article key={c.title} className="card ts-case">
                <span className="ts-meta">
                  {c.client} · {c.sector}
                </span>
                <h3>{c.title}</h3>
                <dl>
                  <dt>The problem</dt>
                  <dd>{c.problem}</dd>
                  <dt>The result</dt>
                  <dd>{c.result}</dd>
                </dl>
                <span className="ts-tag">{c.service}</span>
                {c.url && (
                  <a href={c.url} className="text-link" target="_blank" rel="noopener noreferrer">
                    Visit the project
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="wrap ts-section" aria-label="What clients say">
          <div className="ts-quotes">
            {testimonials.map((t) => (
              <figure key={t.name} className="ts-quote">
                <blockquote>“{t.quote}”</blockquote>
                <figcaption>
                  <strong>{t.name}</strong>
                  <span>
                    {t.role}, {t.company}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {team.length > 0 && (
        <section id="team" className="wrap ts-section">
          <div className="ts-head">
            <span className="eyebrow">Who you’ll work with</span>
            <h2 className="h2">The people behind Genmars.</h2>
          </div>
          <div className="ts-team">
            {team.map((m) => (
              <article key={m.name} className="ts-person">
                {m.photo && <img src={m.photo} alt="" width={96} height={96} />}
                <h3>{m.name}</h3>
                <span className="ts-role">{m.role}</span>
                <p className="muted">{m.bio}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
