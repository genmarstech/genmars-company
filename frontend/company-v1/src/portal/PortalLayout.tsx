import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { logout, useSession } from '../auth/session'
import { Icon, LogoMark } from '../components/Icon'
import { Link } from '../components/Link'
import { navigate, usePathname } from '../router'
import { CommandPalette } from '../team/CommandPalette'
import { MOD_KEY, openPalette } from '../team/paletteKeys'
import { TimerChip } from '../team/Timer'
import './portal.css'

type NavItem = { to: string; label: string; icon: 'layout' | 'code' | 'card' | 'chat' | 'gear' | 'team' | 'mail' | 'check' | 'flow' | 'chart' | 'pen' | 'clock' | 'cart' | 'video' }

const clientNav: NavItem[] = [
  { to: '/portal', label: 'Dashboard', icon: 'layout' },
  { to: '/portal/projects', label: 'Projects', icon: 'code' },
  { to: '/portal/orders', label: 'Orders', icon: 'cart' },
  { to: '/portal/invoices', label: 'Invoices', icon: 'card' },
  { to: '/portal/messages', label: 'Messages', icon: 'chat' },
  { to: '/portal/settings', label: 'Settings', icon: 'gear' },
]

const teamNav: NavItem[] = [
  { to: '/team', label: 'Today', icon: 'layout' },
  { to: '/team/work', label: 'My work', icon: 'check' },
  // the Meetings tool is its own site (frontend/meetings)
  { to: import.meta.env.VITE_MEETINGS_URL || 'https://meetings.genmars.co.ke', label: 'Meetings', icon: 'video' },
  { to: '/team/clients', label: 'Clients', icon: 'team' },
  { to: '/team/projects', label: 'Projects', icon: 'code' },
  { to: '/team/orders', label: 'Orders', icon: 'cart' },
  { to: '/team/leads', label: 'Leads', icon: 'mail' },
  { to: '/team/pipeline', label: 'Pipeline', icon: 'flow' },
  { to: '/team/time', label: 'Time & profit', icon: 'clock' },
  { to: '/team/finance', label: 'Finance', icon: 'chart' },
  { to: '/team/invoices', label: 'Invoices', icon: 'card' },
  { to: '/team/messages', label: 'Messages', icon: 'chat' },
  { to: '/team/services', label: 'Services & prices', icon: 'gear' },
  { to: '/team/brand', label: 'Brand kit', icon: 'pen' },
]

// Phones and small tablets get the off-canvas menu and a compact top bar.
const NARROW = '(max-width: 860px)'
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(NARROW)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  )
}

export function PortalLayout({ title, subtitle, actions, children, nav = clientNav, role = 'Client', search = false }: {
  search?: boolean
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  nav?: NavItem[]
  role?: string
}) {
  const { user } = useSession()
  const path = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const narrow = useNarrow()

  // close the menu on navigation or when the screen crosses the breakpoint
  const menuKey = `${path}|${narrow}`
  const [openedAt, setOpenedAt] = useState(menuKey)
  if (openedAt !== menuKey) {
    setOpenedAt(menuKey)
    setMenuOpen(false)
  }
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('pt-lock')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('pt-lock')
    }
  }, [menuOpen])
  const initials = (user?.full_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const home = nav[0].to
  const isActive = (to: string) => (to === home ? path === home : path.startsWith(to))

  return (
    <div className={`pt${menuOpen ? ' pt--menu' : ''}`}>
      <aside className="pt-side" id="pt-side" inert={narrow && !menuOpen ? true : undefined}>
        <Link to="/" className="pt-brand" aria-label="Genmars Tech home">
          <LogoMark size={34} />
          <span className="pt-word">
            <span>GENMARS</span>
            <span className="pt-tech">TECH</span>
          </span>
        </Link>
        {search && (
          <button type="button" className="pt-search" onClick={openPalette}>
            <Icon name="search" size={16} />
            <span>Search</span>
            <kbd>{MOD_KEY} K</kbd>
          </button>
        )}
        <nav aria-label={role === 'Client' ? 'Portal' : 'Team'} className="pt-nav">
          {nav.map((n) =>
            n.to.startsWith('http') ? (
              <a key={n.to} href={n.to} className="pt-nav-link">
                <Icon name={n.icon} size={18} strokeWidth={1.8} />
                {n.label}
              </a>
            ) : (
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
            ),
          )}
        </nav>
        <div className="pt-user">
          <span className="pt-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="pt-user-text">
            <strong>{user?.full_name}</strong>
            <span>{role}</span>
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

      {narrow && menuOpen && <button type="button" className="pt-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setMenuOpen(false)} />}

      <div className="pt-main">
        <div className="pt-mbar">
          <button
            type="button"
            className="pt-icon-btn pt-menu-btn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="pt-side"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
          </button>
          <Link to={home} className="pt-mbar-brand" aria-label={`${role === 'Client' ? 'Portal' : 'Team'} home`}>
            <LogoMark size={28} />
          </Link>
          <div className="pt-mbar-tools">
            {search && narrow && <TimerChip />}
            {search && (
              <button type="button" className="pt-icon-btn" aria-label="Search" onClick={openPalette}>
                <Icon name="search" size={18} />
              </button>
            )}
          </div>
        </div>
        <header className="pt-top">
          <div className="pt-head">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {(actions || (search && !narrow)) && (
            <div className="pt-actions">
              {search && !narrow && <TimerChip />}
              {actions}
            </div>
          )}
        </header>
        <main id="main" className="pt-content">
          {children}
        </main>
      </div>
      {search && <CommandPalette />}
    </div>
  )
}

export function TeamLayout(props: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return <PortalLayout {...props} nav={teamNav} role="Genmars team" search />
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
