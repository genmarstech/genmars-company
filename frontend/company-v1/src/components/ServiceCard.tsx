import { useState } from 'react'
import { formatKes, type Service } from '../data/site'
import { Icon } from './Icon'
import { Link } from './Link'
import './ServiceCard.css'

// Photos: Pexels (free licence). The details panel opens on hover, keyboard focus or tap.
export function ServiceCard({ service: s }: { service: Service }) {
  const [open, setOpen] = useState(false)
  const panelId = `svc-more-${s.slug}`

  return (
    <article className={`card svc-card${open ? ' svc-card--open' : ''}`}>
      <div className="svc-media">
        <img src={`/services/${s.slug}.jpg`} alt="" loading="lazy" width={800} height={500} />
        <div className="svc-more" id={panelId}>
          <span className="svc-more-label">What’s included</span>
          <ul className="tick">
            {s.includes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <span className="svc-more-time">Typical timeline: {s.timeline}</span>
          <Link to={`/services#${s.slug}`} className="text-link">
            Full details <Icon name="arrow" size={16} />
          </Link>
        </div>
      </div>
      <div className="svc-body">
        <h3 className="svc-title">{s.title}</h3>
        <p className="muted">{s.desc}</p>
        <div className="svc-foot">
          <span className="svc-price">
            {s.from === null ? 'Quoted per project' : `From ${formatKes(s.from)}`}
            {s.per && <span className="svc-per"> / {s.per}</span>}
          </span>
          <button
            type="button"
            className="svc-toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Hide details' : 'What’s included'}
          </button>
        </div>
      </div>
    </article>
  )
}
