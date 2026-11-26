import type { ReactNode } from 'react'
import { TEAM_URL } from '../meetingTypes'
import { navigate } from '../router'
import { logout, useSession } from '../session'
import { Icon, LogoMark } from './Icon'
import { Link } from './Link'

/** The meetings site's frame: a slim top bar, then the page title and its actions. */
export function Layout({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const { user } = useSession()
  return (
    <div className="ml">
      <header className="ml-bar">
        <Link to="/" className="ml-brand" aria-label="Genmars Meetings home">
          <LogoMark size={30} />
          <span className="ml-word">
            GENMARS <span>Meetings</span>
          </span>
        </Link>
        <nav className="ml-nav" aria-label="Genmars">
          <a href={`${TEAM_URL}/team`}>Team dashboard</a>
        </nav>
        <span className="ml-user">
          <span className="ml-user-name">{user?.full_name}</span>
          <button
            type="button"
            className="pt-icon-btn"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <Icon name="logout" size={18} />
          </button>
        </span>
      </header>
      <div className="ml-head">
        <div className="pt-head">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="pt-actions">{actions}</div>}
      </div>
      <main id="main" className="pt-content ml-content">
        {children}
      </main>
    </div>
  )
}

export function Panel({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`pt-panel ${className}`}>
      {(title || action) && (
        <div className="pt-panel-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatusBadge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`pt-badge pt-badge--${tone}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="pt-empty">{children}</p>
}

export function Loading({ error }: { error?: string }) {
  return error ? <p className="pt-error">{error}</p> : <p className="pt-loading">Loading…</p>
}
