import { useSession } from '../auth/session'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, TeamLayout } from '../portal/PortalLayout'
import { formatDate, useApi } from '../portal/useApi'
import { ActivityChart } from './Chart'
import type { TeamSummary } from './types'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function TeamDashboard() {
  const { user } = useSession()
  const { data, error } = useApi<TeamSummary>('/api/v1/team/summary/')

  return (
    <TeamLayout
      title={`${greeting()}, ${user?.full_name.split(' ')[0] ?? ''}!`}
      subtitle="Here’s what’s happening with your team today."
      actions={
        <Link to="/team/projects?new=1" className="btn btn--sm">
          New project <Icon name="arrow" size={16} />
        </Link>
      }
    >
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="pt-stats">
            <Stat label="Total projects" value={data.total_projects} />
            <Stat label="In progress" value={data.in_progress} note={data.at_risk ? `${data.at_risk} at risk` : 'None at risk'} />
            <Stat label="Completed" value={data.completed} />
            <Stat label="Clients" value={data.clients} note={`+${data.new_clients_this_month} this month`} />
          </div>

          <div className="tm-alerts">
            <Alert to="/team/leads" count={data.new_enquiries} label="new leads" />
            <Alert to="/team/messages" count={data.unanswered_messages} label="messages waiting for a reply" />
            <Alert to="/team/invoices" count={data.unpaid_invoices} label="unpaid invoices" />
          </div>

          <div className="pt-two">
            <Panel title="Project activity · last 7 days">
              <ActivityChart days={data.activity} />
            </Panel>
            <Panel title="Upcoming tasks">
              {data.upcoming.length === 0 ? (
                <Empty>No milestones with due dates yet.</Empty>
              ) : (
                <ul className="pt-activity">
                  {data.upcoming.map((t) => (
                    <li key={t.id}>
                      <span className={`pt-act-icon ${t.overdue ? 'tm-overdue' : 'pt-act-icon--message'}`}>
                        <Icon name="check" size={15} />
                      </span>
                      <Link to={`/team/projects/${t.project_id}`} className="tm-task">
                        <strong>{t.title}</strong>
                        <span className="pt-muted">
                          {t.project} · {t.client} · {t.overdue ? 'Overdue since ' : 'Due '}
                          {formatDate(t.due_date, false)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </TeamLayout>
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

function Alert({ to, count, label }: { to: string; count: number; label: string }) {
  return (
    <Link to={to} className={`tm-alert${count ? ' tm-alert--on' : ''}`}>
      <strong>{count}</strong> {label}
      <Icon name="arrow" size={14} />
    </Link>
  )
}
