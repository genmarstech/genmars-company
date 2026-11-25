import { company, CONTACT_EMAIL, services } from '../data/site'
import { Icon, LogoMark } from './Icon'
import { Link } from './Link'
import './SiteFooter.css'

const values = [
  { icon: 'shield', label: 'Secure & reliable' },
  { icon: 'chart', label: 'Scalable solutions' },
  { icon: 'team', label: 'Expert team' },
  { icon: 'support', label: 'Dedicated support' },
] as const

export function SiteFooter() {
  return (
    <footer className="sf">
      <div className="wrap sf-band">
        <div className="sf-logo">
          <LogoMark size={40} />
          <span className="sf-word">
            <span>GENMARS</span>
            <span className="sf-tech">TECH</span>
          </span>
        </div>
        <p className="sf-slogan">Build smarter. Grow faster.</p>
        <ul className="sf-values">
          {values.map((v) => (
            <li key={v.label}>
              <Icon name={v.icon} size={22} strokeWidth={1.7} />
              {v.label}
            </li>
          ))}
        </ul>
        <Link to="/contact" className="btn sf-cta">
          Get a quote <Icon name="arrow" size={18} />
        </Link>
      </div>

      <div className="wrap sf-inner">
        <div className="sf-top">
          <div className="sf-brand">
            <p>Websites, online shops and business software for businesses of every size.</p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            {company.phone && <a href={`tel:${company.phone}`}>{company.phone}</a>}
          </div>
          <div className="sf-cols">
            <div className="sf-col">
              <span className="label">Services</span>
              {services.slice(0, 5).map((s) => (
                <Link key={s.slug} to={`/services#${s.slug}`}>
                  {s.title}
                </Link>
              ))}
            </div>
            <div className="sf-col">
              <span className="label">Company</span>
              <Link to="/how-we-work">How we work</Link>
              <Link to="/services#faq">Questions</Link>
              <Link to="/contact">Contact</Link>
            </div>
          </div>
        </div>
        <div className="sf-bottom">
          <span>
            © {new Date().getFullYear()} {company.legalName || 'Genmars Tech'}
            {company.registrationNo && ` · Reg. no. ${company.registrationNo}`}
          </span>
          <span>{[company.address, company.city].filter(Boolean).join(', ')}</span>
        </div>
      </div>
    </footer>
  )
}
