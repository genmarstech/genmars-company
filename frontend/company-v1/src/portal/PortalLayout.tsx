import { useState, type ReactNode } from 'react'
import { logout, useSession } from '../auth/session'
import { Icon, LogoMark } from '../components/Icon'
import { Link } from '../components/Link'
import { navigate, usePathname } from '../router'
import './portal.css'

const nav = [
  { to: '/portal', label: 'Dashboard', icon: 'layout' },
  { to: '/portal/projects', label: 'Projects', icon: 'code' },
  { to: '/portal/invoices', label: 'Invoices', icon: 'card' },
  { to: '/portal/messages', label: 'Messages', icon: 'chat' },
  { to: '/portal/settings', label: 'Settings', icon: 'gear' },
] as const

export function PortalLayout({ title, subtitle, actions, children }: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { user } = useSession()
  const path = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const initials = (user?.full_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const isActive = (to: string) => (to === '/portal' ? path === '/portal' : path.startsWith(to))

  return (
    <div className={`pt${menuOpen ? ' pt--menu' : ''}`}>
      <aside className="pt-side">
        <Link to="/" className="pt-brand" aria-label="Genmars Tech home">
          <LogoMark size={34} />
          <span className="pt-word">
            <span>GENMARS</span>
            <span className="pt-tech">TECH</span>
          </span>
        </Link>
        <nav aria-label="Portal" className="pt-nav">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="pt-nav-link"
              aria-current={isActive(n.to) ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={n.icon} size={18} strokeWidth={1.8} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="pt-user">
          <span className="pt-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="pt-user-text">
            <strong>{user?.full_name}</strong>
            <span>Client</span>
          </span>
          <button
            type="button"
            className="pt-icon-btn"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await logout()
              navigate('/')
            }}
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <div className="pt-main">
        <header className="pt-top">
          <button
            type="button"
            className="pt-icon-btn pt-menu-btn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
          </button>
          <div className="pt-head">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="pt-actions">{actions}</div>
        </header>
        <main id="main" className="pt-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export function Panel({ title, action, children, className = '' }: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
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
