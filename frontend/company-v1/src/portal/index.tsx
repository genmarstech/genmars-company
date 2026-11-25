import { useEffect } from 'react'
import { useSession } from '../auth/session'
import { navigate } from '../router'
import { Dashboard } from './Dashboard'
import { Invoices } from './Invoices'
import { Messages } from './Messages'
import { ProjectDetail, ProjectsList } from './Projects'
import { Requests } from './Requests'
import { Settings } from './Settings'

/** The client portal: signed-in only, with its own sidebar layout. */
export function Portal({ path }: { path: string }) {
  const { user } = useSession()

  useEffect(() => {
    if (!user) navigate(`/login?next=${encodeURIComponent(path)}`)
  }, [user, path])

  if (!user) return null

  const project = path.match(/^\/portal\/projects\/(\d+)$/)
  if (project) return <ProjectDetail id={project[1]} />
  switch (path) {
    case '/portal/projects':
      return <ProjectsList />
    case '/portal/requests':
      return <Requests />
    case '/portal/invoices':
      return <Invoices />
    case '/portal/messages':
      return <Messages />
    case '/portal/settings':
      return <Settings />
    default:
      return <Dashboard />
  }
}
