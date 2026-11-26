import { useEffect } from 'react'
import { Login } from './Login'
import { MeetingDetail } from './MeetingDetail'
import { Home } from './Home'
import { CalendarPage, HistoryPage, InsightsPage, SettingsPage } from './Pages'
import { navigate, usePathname } from './router'
import { useSession } from './session'

export default function App() {
  const path = usePathname().replace(/\/+$/, '') || '/'
  const { user } = useSession()
  const signedIn = !!user?.is_staff

  useEffect(() => {
    if (!signedIn && path !== '/login') navigate(`/login?next=${encodeURIComponent(path + window.location.search)}`)
  }, [signedIn, path])

  if (path === '/login') return <Login />
  if (!signedIn) return null
  const meeting = path.match(/^\/(\d+)$/)
  if (meeting) return <MeetingDetail key={meeting[1]} id={meeting[1]} />
  switch (path) {
    case '/calendar':
      return <CalendarPage key={window.location.search} />
    case '/history':
      return <HistoryPage key={window.location.search} />
    case '/insights':
      return <InsightsPage />
    case '/settings':
      return <SettingsPage />
    default:
      return <Home key={window.location.search} />
  }
}
