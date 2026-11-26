import { useEffect } from 'react'
import { PrivacyPage, TermsPage } from './Legal'
import { Login } from './Login'
import { MeetingDetail } from './MeetingDetail'
import { Home, UpcomingPage } from './Home'
import { ActionsPage, CalendarPage, DecisionsPage, InsightsPage, RecordsPage, SettingsPage } from './Pages'
import { navigate, usePathname } from './router'
import { useSession } from './session'

export default function App() {
  const path = usePathname().replace(/\/+$/, '') || '/'
  const { user } = useSession()
  const signedIn = !!user?.is_staff
  // anyone can read these, signed in or not (Google links to them from the consent screen)
  const isPublic = path === '/login' || path === '/privacy' || path === '/terms'

  useEffect(() => {
    if (!signedIn && !isPublic) navigate(`/login?next=${encodeURIComponent(path + window.location.search)}`)
  }, [signedIn, isPublic, path])

  if (path === '/privacy') return <PrivacyPage />
  if (path === '/terms') return <TermsPage />
  if (path === '/login') return <Login />
  if (!signedIn) return null
  const meeting = path.match(/^\/(\d+)$/)
  if (meeting) return <MeetingDetail key={meeting[1]} id={meeting[1]} />
  switch (path) {
    case '/calendar':
      return <CalendarPage key={window.location.search} />
    case '/upcoming':
      return <UpcomingPage />
    case '/records':
    case '/history':
      return <RecordsPage key={window.location.search} />
    case '/decisions':
      return <DecisionsPage />
    case '/actions':
      return <ActionsPage />
    case '/insights':
      return <InsightsPage />
    case '/settings':
      return <SettingsPage />
    default:
      return <Home key={window.location.search} />
  }
}
