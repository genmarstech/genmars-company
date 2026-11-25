import { Icon } from '../components/Icon'
import { Link } from '../components/Link'

export function NotFound() {
  return (
    <section
      className="wrap"
      style={{ paddingTop: 140, paddingBottom: 160, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24 }}
    >
      <span className="eyebrow">404</span>
      <h1 className="h2">
        We can’t find that page.
      </h1>
      <p className="lead" style={{ maxWidth: 520 }}>
        The link may be old, or the page may have moved.
      </p>
      <Link to="/" className="btn btn--lg">
        Back to home <Icon name="arrow" />
      </Link>
    </section>
  )
}
