import { useEffect } from 'react'
import { useSession } from '../auth/session'
import { navigate } from '../router'
import { Clients } from './Clients'
import { TeamInvoices } from './Invoices'
import { Leads } from './Leads'
import { TeamMessages } from './Messages'
import { TeamProjectDetail, TeamProjects } from './Projects'
import { TeamDashboard } from './TeamDashboard'
import './team.css'

/** The team dashboard: Genmars staff only. */
export function Team({ path }: { path: string }) {
  const { user } = useSession()

  useEffect(() => {
    if (!user) navigate(`/login?next=${encodeURIComponent(path)}`)
    else if (!user.is_staff) navigate('/portal')
  }, [user, path])

  if (!user?.is_staff) return null

  const project = path.match(/^\/team\/projects\/(\d+)$/)
  if (project) return <TeamProjectDetail key={project[1]} id={project[1]} />
  switch (path) {
    case '/team/clients':
      return <Clients />
    case '/team/projects':
      return <TeamProjects key={window.location.search} />
    case '/team/leads':
      return <Leads />
    case '/team/invoices':
      return <TeamInvoices />
    case '/team/messages':
      return <TeamMessages />
    default:
      return <TeamDashboard />
  }
}
