import { useSession } from '../auth/session'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, PortalLayout } from './PortalLayout'
import { kes, timeAgo, useApi, type Summary } from './useApi'
import { ProgressBar } from './Projects'

export function Dashboard() {
  const { user } = useSession()
  const { data, error } = useApi<Summary>('/api/v1/portal/summary/')

  return (
    <PortalLayout
      title="Dashboard"
      subtitle={`Welcome back, ${user?.full_name.split(' ')[0] ?? ''}. Here’s where your projects stand.`}
      actions={
        <Link to="/contact" className="btn btn--sm">
          New project <Icon name="arrow" size={16} />
        </Link>
      }
    >
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="pt-stats">
            <Stat label="Active projects" value={data.active_projects} />
            <Stat label="Completed" value={data.completed_projects} />
            <Stat label="Invoices" value={data.invoices} note={Number(data.unpaid_total) ? `${kes(data.unpaid_total)} due` : 'All paid'} />
            <Stat label="Unread messages" value={data.unread_messages} />
          </div>

          <div className="pt-two">
            <Panel
              title="Project progress"
              action={
                <Link to="/portal/projects" className="pt-more">
                  See all <Icon name="arrow" size={14} />
                </Link>
              }
            >
              {data.projects.length === 0 ? (
                <Empty>
                  No active projects yet. Once we agree a quote, your project and its timeline appear here.{' '}
                  <Link to="/contact">Start a project</Link>
                </Empty>
              ) : (
                <ul className="pt-list">
                  {data.projects.map((p) => (
                    <li key={p.id}>
                      <Link to={`/portal/projects/${p.id}`} className="pt-proj-row">
                        <span className="pt-proj-icon">
                          <Icon name="layout" size={16} />
                        </span>
                        <span className="pt-proj-main">
                          <strong>{p.name}</strong>
                          <ProgressBar value={p.progress} />
                        </span>
                        <span className="pt-proj-pct">{p.progress}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Recent activity">
              {data.activity.length === 0 ? (
                <Empty>Updates from your projects will show here.</Empty>
              ) : (
                <ul className="pt-activity">
                  {data.activity.map((a, i) => (
                    <li key={i}>
                      <span className={`pt-act-icon pt-act-icon--${a.kind}`}>
                        <Icon name={a.kind === 'message' ? 'chat' : 'check'} size={15} />
                      </span>
                      <span>
                        <strong>{a.text}</strong>
                        <span className="pt-muted">
                          {a.project && `${a.project} · `}
                          {timeAgo(a.at)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </PortalLayout>
  )
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="pt-stat">
      <span className="pt-stat-label">{label}</span>
      <span className="pt-stat-value">{value}</span>
      {note && <span className="pt-stat-note">{note}</span>}
    </div>
  )
}
