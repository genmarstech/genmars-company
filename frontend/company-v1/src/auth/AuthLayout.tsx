import { useState, type ReactNode } from 'react'
import { Icon, LogoMark } from '../components/Icon'
import { Link } from '../components/Link'
import { ServiceArt } from '../components/ServiceArt'
import './auth.css'

const perks = [
  'Follow every project milestone as it happens',
  'See invoices and pay by M-Pesa, bank or card',
  'Message the team building your product',
]

export function AuthLayout({ title, subtitle, children, footer, social = false }: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
  /** Show Google, GitHub and Microsoft buttons above the email form. */
  social?: boolean
}) {
  return (
    <div className="au">
      <aside className="au-brandside" aria-hidden="true">
        <div className="au-brandside-top">
          <span className="au-logo">
            <LogoMark size={36} />
            <span className="au-word au-word--light">
              <span>GENMARS</span>
              <span className="au-tech">TECH</span>
            </span>
          </span>
        </div>
        <div className="au-pitch">
          <h2>Your projects, invoices and team in one place.</h2>
          <ul>
            {perks.map((p) => (
              <li key={p}>
                <Icon name="check" size={16} strokeWidth={2.4} /> {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="au-mock">
          <ServiceArt slug="custom-software" />
          <div className="au-toast">
            <span className="au-toast-icon">
              <Icon name="check" size={14} strokeWidth={2.6} />
            </span>
            <span>
              <strong>Design phase completed</strong>
              <span>Website Redesign · just now</span>
            </span>
          </div>
        </div>
        <p className="au-legal">© {new Date().getFullYear()} Genmars Tech · Nairobi</p>
      </aside>

      <div className="au-main">
        <div className="au-panel">
          <Link to="/" className="au-brand" aria-label="Genmars Tech home">
            <LogoMark size={40} />
            <span className="au-word">
              <span>GENMARS</span>
              <span className="au-tech">TECH</span>
            </span>
          </Link>
          <div className="au-heading">
            <h1 className="au-title">{title}</h1>
            <p className="au-subtitle">{subtitle}</p>
          </div>
          {social && <SocialButtons />}
          {children}
          {footer && <p className="au-footer">{footer}</p>}
        </div>
        <Link to="/" className="au-back">
          ← Back to genmars.co.ke
        </Link>
      </div>
    </div>
  )
}

const providers = [
  {
    name: 'Google',
    logo: (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    ),
  },
  {
    name: 'GitHub',
    logo: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z" />
      </svg>
    ),
  },
  {
    name: 'Microsoft',
    logo: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
        <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
        <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
        <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
      </svg>
    ),
  },
]

// The buttons are in place for when the OAuth apps are set up; until then they explain that.
function SocialButtons() {
  const [notice, setNotice] = useState('')
  return (
    <div className="au-social">
      <div className="au-social-row">
        {providers.map((p) => (
          <button
            key={p.name}
            type="button"
            className="au-social-btn"
            aria-describedby="au-social-note"
            onClick={() => setNotice(`Signing in with ${p.name} is coming soon. Please use your email for now.`)}
          >
            {p.logo}
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <p id="au-social-note" className="au-social-note" role="status">
        {notice}
      </p>
      <div className="au-divider">
        <span>or continue with email</span>
      </div>
    </div>
  )
}
