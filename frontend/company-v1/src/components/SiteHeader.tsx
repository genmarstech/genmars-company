import { useEffect, useState } from 'react'
import { usePathname } from '../router'
import { Link } from './Link'
import { caseStudies } from '../data/site'
import { Icon, LogoMark } from './Icon'
import './SiteHeader.css'

const links = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  ...(caseStudies.length ? [{ to: '/#work', label: 'Our work' }] : []),
  { to: '/how-we-work', label: 'How we work' },
  { to: '/contact', label: 'Contact' },
]

export function SiteHeader() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`sh${scrolled ? ' sh--scrolled' : ''}${open ? ' sh--open' : ''}`}>
      <nav aria-label="Main" className="wrap sh-nav">
        <Link to="/" className="sh-brand">
          <LogoMark label="Genmars Tech home" />
          <span className="sh-word">
            <span className="sh-name">GENMARS</span>
            <span className="sh-tech">TECH</span>
          </span>
        </Link>

        <div className="sh-links" id="site-menu">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              aria-current={l.to === path ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="sh-actions">
          <Link to="/contact" className="btn btn--sm">
            Get a quote
            <Icon name="arrow" size={16} />
          </Link>
          <button
            type="button"
            className="sh-toggle"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </nav>
    </header>
  )
}
