import { useEffect } from 'react'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { logout, refreshUser, useSession } from '../auth/session'
import { navigate } from '../router'

// Placeholder until the client portal (phase 3) replaces it.
export function Account() {
  const { user } = useSession()

  useEffect(() => {
    if (!user) navigate('/login?next=/account')
    else refreshUser()
  }, [user])

  if (!user) return null

  return (
    <section className="wrap" style={{ paddingTop: 72, paddingBottom: 120, display: 'grid', gap: 24, maxWidth: 760 }}>
      <span className="eyebrow eyebrow--line">Your account</span>
      <h1 className="h2">Welcome, {user.full_name.split(' ')[0]}.</h1>
      <p className="lead">
        You’re signed in as <strong>{user.email}</strong>. Your client portal, with projects, invoices and messages, is
        on its way. In the meantime, send us a brief and we’ll set up your first project.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Link to="/contact" className="btn btn--lg">
          Start a project <Icon name="arrow" />
        </Link>
        {!user.onboarding_completed && (
          <Link to="/onboarding" className="btn btn--lg btn--ghost">
            Finish setting up
          </Link>
        )}
        <button
          type="button"
          className="btn btn--lg btn--ghost"
          onClick={async () => {
            await logout()
            navigate('/')
          }}
        >
          Sign out
        </button>
      </div>
    </section>
  )
}
