import type { ReactNode } from 'react'
import { Link } from '../components/Link'
import { LogoMark } from '../components/Icon'
import './auth.css'

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="au">
      <div className="au-card">
        <Link to="/" className="au-brand" aria-label="Genmars Tech home">
          <LogoMark size={48} />
          <span className="au-word">
            <span>GENMARS</span>
            <span className="au-tech">TECH</span>
          </span>
        </Link>
        <h1 className="au-title">{title}</h1>
        <p className="au-subtitle">{subtitle}</p>
        {children}
        {footer && <p className="au-footer">{footer}</p>}
      </div>
      <Link to="/" className="au-back">
        ← Back to genmars.co.ke
      </Link>
    </div>
  )
}
