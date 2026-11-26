import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { TEAM_URL, type GoogleStatus } from '../meetingTypes'
import { navigate, usePathname } from '../router'
import { logout, useSession } from '../session'
import { useApi } from '../useApi'
import { Icon, LogoMark, type IconName } from './Icon'
import { Link } from './Link'

type NavItem = { label: string; icon: IconName; to: string; external?: boolean }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

// Home, Projects and Tasks live on the team dashboard; the rest is this site.
const NAV: NavItem[] = [
  { label: 'Home', icon: 'home', to: `${TEAM_URL}/team`, external: true },
  { label: 'Projects', icon: 'folder', to: `${TEAM_URL}/team/projects`, external: true },
  { label: 'Tasks', icon: 'tasks', to: `${TEAM_URL}/team/work`, external: true },
  { label: 'Meetings', icon: 'video', to: '/' },
  { label: 'Calendar', icon: 'calendar', to: '/calendar' },
  { label: 'History', icon: 'history', to: '/history' },
  { label: 'Analytics', icon: 'chart', to: '/insights' },
  { label: 'Settings', icon: 'gear', to: '/settings' },
]

/** The site frame from the design: sidebar, search bar, then the page. */
export function Layout({ title, subtitle, actions, children }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const { user } = useSession()
  const path = usePathname()
  const [menu, setMenu] = useState(false)
  const google = useApi<GoogleStatus>('/api/v1/integrations/google/status/').data
  const search = useRef<HTMLInputElement>(null)
  const initials = (user?.full_name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const active = (to: string) => (to === '/' ? path === '/' || /^\/\d+$/.test(path) : path.startsWith(to))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const find = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = search.current?.value.trim() ?? ''
    navigate(q ? `/history?q=${encodeURIComponent(q)}` : '/history')
  }

  return (
    <div className={`ms${menu ? ' ms--menu' : ''}`}>
      <aside className="ms-side">
        <Link to="/" className="ms-brand" aria-label="Genmars Meetings">
          <LogoMark size={40} />
          <span className="ms-word">
            <span>GENMARS</span>
            <span className="ms-tech">TECH</span>
          </span>
        </Link>
        <nav className="ms-nav" aria-label="Main">
          {NAV.map((n) =>
            n.external ? (
              <a key={n.label} href={n.to} className="ms-nav-link">
                <Icon name={n.icon} size={20} strokeWidth={1.8} />
                {n.label}
              </a>
            ) : (
              <Link key={n.label} to={n.to} className="ms-nav-link" aria-current={active(n.to) ? 'page' : undefined} onClick={() => setMenu(false)}>
                <Icon name={n.icon} size={20} strokeWidth={1.8} />
                {n.label}
              </Link>
            ),
          )}
        </nav>
        <div className="ms-promo" aria-hidden="true">
          <span className="ms-promo-icon">
            <Icon name="spark" size={20} strokeWidth={1.6} />
          </span>
          <strong>Built for innovation</strong>
          <span>Together, we build better.</span>
        </div>
      </aside>

      <div className="ms-main">
        <header className="ms-top">
          <button type="button" className="pt-icon-btn ms-menu-btn" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Icon name={menu ? 'close' : 'tasks'} size={20} />
          </button>
          <form className="ms-search" role="search" onSubmit={find}>
            <Icon name="search" size={18} />
            <input ref={search} type="search" placeholder="Search meetings, decisions, people…" aria-label="Search meetings" />
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </form>
          <span className={`ms-status${google?.connected ? ' is-on' : ''}`}>
            <i aria-hidden="true" />
            {google ? (google.connected ? 'Google Meet connected' : 'Google Meet not connected') : 'Checking…'}
          </span>
          <span className="ms-user">
            <span className="ms-avatar" title={user?.full_name}>{initials}</span>
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
        <main id="main" className="ms-content">
          {title && (
            <div className="ms-head">
              <div>
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
              </div>
              {actions && <div className="pt-actions">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
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
