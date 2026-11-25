import { useEffect } from 'react'
import { useSession } from '../auth/session'
import { navigate } from '../router'
import { BrandKit } from './BrandKit'
import { ClientDetail } from './ClientDetail'
import { Clients } from './Clients'
import { FinancePage } from './Finance'
import { Pipeline } from './Pipeline'
import { TeamInvoices } from './Invoices'
import { Leads } from './Leads'
import { TeamMessages } from './Messages'
import { TeamProjectDetail, TeamProjects } from './Projects'
import { MyWork } from './Tasks'
import { TeamDashboard } from './TeamDashboard'
import { TimePage } from './Time'
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
  const client = path.match(/^\/team\/clients\/(\d+)$/)
  if (client) return <ClientDetail key={client[1]} id={client[1]} />
  switch (path) {
    case '/team/work':
      return <MyWork key={window.location.search} />
    case '/team/time':
      return <TimePage />
    case '/team/clients':
      return <Clients />
    case '/team/projects':
      return <TeamProjects key={window.location.search} />
    case '/team/leads':
      return <Leads />
    case '/team/pipeline':
      return <Pipeline />
    case '/team/brand':
      return <BrandKit />
    case '/team/finance':
      return <FinancePage />
    case '/team/invoices':
      return <TeamInvoices />
    case '/team/messages':
      return <TeamMessages />
    default:
      return <TeamDashboard />
  }
}
