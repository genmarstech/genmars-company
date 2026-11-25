import { company, CONTACT_EMAIL } from '../data/site'
import { Link } from './Link'
import { LogoMark } from './Icon'
import './SiteFooter.css'

export function SiteFooter() {
  return (
    <footer className="sf">
      <div className="wrap sf-inner">
        <div className="sf-top">
          <div className="sf-brand">
            <div className="sf-logo">
              <LogoMark size={30} />
              <span>
                Genmars <span className="sf-tech">TECH</span>
              </span>
            </div>
            <p>Websites, online shops and business software for Kenyan businesses.</p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            {company.phone && <a href={`tel:${company.phone}`}>{company.phone}</a>}
          </div>
          <div className="sf-cols">
            <div className="sf-col">
              <span className="label">Services</span>
              <Link to="/services#custom-software">Custom software</Link>
              <Link to="/services#websites">Websites</Link>
              <Link to="/services#e-commerce">E-commerce</Link>
              <Link to="/services#automation">Automation</Link>
              <Link to="/services#maintenance">Maintenance</Link>
            </div>
            <div className="sf-col">
              <span className="label">Company</span>
              <Link to="/#process">How we work</Link>
              <Link to="/#about">Working with us</Link>
              <Link to="/services#faq">Questions</Link>
              <Link to="/#contact">Contact</Link>
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
