import { useSession } from '../auth/session'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, StatusBadge, TeamLayout } from '../portal/PortalLayout'
import { formatDate, kes, timeAgo, useApi } from '../portal/useApi'
import { ActivityChart } from './Chart'
import { hm, useMutation } from './shared'
import type { TeamSummary, Today } from './types'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function TeamDashboard() {
  const { user } = useSession()
  const today = useApi<Today>('/api/v1/team/today/')
  const { data, error } = useApi<TeamSummary>('/api/v1/team/summary/')
  const t = today.data
  const needs = t ? t.orders_waiting.length + t.my_tasks_due.length + t.overdue_invoices.length + t.at_risk_projects.length + t.stalled_leads.length : 0
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <TeamLayout
      title={`${greeting()}, ${user?.full_name.split(' ')[0] ?? ''}`}
      subtitle={t ? `${dateLine}. ${needs ? `${plural(needs, 'thing')} to look at today.` : 'Nothing urgent today.'}` : dateLine}
      actions={
        <Link to="/team/work?new=1" className="btn btn--sm">
          New task <Icon name="arrow" size={16} />
        </Link>
      }
    >
      {!t ? (
        <Loading error={today.error} />
      ) : (
        <div className="tm-today">
          {t.orders_waiting.length > 0 && (
            <Panel title={`Orders waiting on us · ${t.orders_waiting.length}`} className="tm-wide" action={<Link to="/team/orders" className="pt-more">All orders</Link>}>
              <ul className="tm-prio">
                {t.orders_waiting.slice(0, 6).map((o) => (
                  <li key={o.id}>
                    <Link to={`/team/orders/${o.id}`}>
                      <strong>{o.client}</strong>
                      <span className="pt-muted pt-small">
                        {o.service} · {o.status === 'accepted' ? 'quote accepted, start the project' : 'needs a quote'}
                        {o.assignee ? ` · ${o.assignee}` : ''}
                      </span>
                    </Link>
                    <span className={`pt-small tm-nowrap ${o.days >= 1 ? 'tm-bad' : 'pt-muted'}`}>{o.days === 0 ? 'Today' : `Waiting ${plural(o.days, 'day')}`}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Your tasks due" action={<Link to="/team/work" className="pt-more">{plural(t.my_open_tasks, 'open task')}</Link>}>
            <DueTasks tasks={t.my_tasks_due} onDone={today.reload} />
            {t.my_minutes_today > 0 && <p className="pt-muted pt-small tm-foot">You’ve logged {hm(t.my_minutes_today)} today.</p>}
          </Panel>

          <Panel
            title="Overdue invoices"
            action={t.overdue_invoices.length > 0 && <span className="tm-sum tm-bad">{kes(t.overdue_total)}</span>}
          >
            {t.overdue_invoices.length === 0 ? (
              <Empty>Every sent invoice is within its due date.</Empty>
            ) : (
              <ul className="tm-prio">
                {t.overdue_invoices.slice(0, 6).map((i) => (
                  <li key={i.id}>
                    <Link to={`/team/clients/${i.client_id}`}>
                      <strong>{i.client}</strong>
                      <span className="pt-muted pt-small">
                        {i.number} · {i.days === null ? 'marked overdue' : `${plural(i.days, 'day')} late`}
                      </span>
                    </Link>
                    <span className="pt-num">{kes(i.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Projects at risk" action={<Link to="/team/projects" className="pt-more">All projects</Link>}>
            {t.at_risk_projects.length === 0 ? (
              <Empty>All active projects look healthy.</Empty>
            ) : (
              <ul className="tm-prio">
                {t.at_risk_projects.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link to={`/team/projects/${p.id}`}>
                      <strong>{p.name}</strong>
                      <span className="pt-muted pt-small">
                        {p.client} · {p.progress}% done{p.due_date ? ` · due ${formatDate(p.due_date, false)}` : ''}
                      </span>
                    </Link>
                    <span className="tm-reasons">
                      {p.reasons.map((r) => (
                        <StatusBadge key={r} tone={p.health === 'off_track' ? 'red' : 'amber'}>
                          {r}
                        </StatusBadge>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Leads going cold" action={<Link to="/team/pipeline" className="pt-more">Pipeline</Link>}>
            {t.stalled_leads.length === 0 ? (
              <Empty>Every lead has been touched recently.</Empty>
            ) : (
              <ul className="tm-prio">
                {t.stalled_leads.slice(0, 6).map((l) => (
                  <li key={l.id}>
                    <Link to={`/team/leads#lead-${l.id}`}>
                      <strong>{l.name}</strong>
                      <span className="pt-muted pt-small">
                        {l.service} · {l.status_label}
                      </span>
                    </Link>
                    <span className="pt-muted pt-small tm-nowrap">{l.status === 'new' ? `Waiting ${plural(l.days, 'day')}` : `Quiet ${plural(l.days, 'day')}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {t.waiting_replies_count > 0 && (
            <Panel title={`Waiting for a reply · ${t.waiting_replies_count}`} className="tm-wide" action={<Link to="/team/messages" className="pt-more">Messages</Link>}>
              <ul className="tm-prio">
                {t.waiting_replies.map((m) => (
                  <li key={m.client}>
                    <Link to={`/team/messages?client=${m.client}`}>
                      <strong>{m.client_name}</strong>
                      <span className="pt-muted pt-small tm-clip">{m.last_message}</span>
                    </Link>
                    <span className="pt-muted pt-small tm-nowrap">{timeAgo(m.last_at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <h2 className="tm-section">This week</h2>
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

          <div className="pt-two">
            <Panel title="Project activity · last 7 days">
              <ActivityChart days={data.activity} />
            </Panel>
            <Panel title="Upcoming milestones">
              {data.upcoming.length === 0 ? (
                <Empty>No milestones with due dates yet.</Empty>
              ) : (
                <ul className="pt-activity">
                  {data.upcoming.map((m) => (
                    <li key={m.id}>
                      <span className={`pt-act-icon ${m.overdue ? 'tm-overdue' : 'pt-act-icon--message'}`}>
                        <Icon name="check" size={15} />
                      </span>
                      <Link to={`/team/projects/${m.project_id}`} className="tm-task">
                        <strong>{m.title}</strong>
                        <span className="pt-muted">
                          {m.project} · {m.client} · {m.overdue ? 'Overdue since ' : 'Due '}
                          {formatDate(m.due_date, false)}
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

function DueTasks({ tasks, onDone }: { tasks: Today['my_tasks_due']; onDone: () => void }) {
  const { busy, run } = useMutation()
  if (tasks.length === 0) return <Empty>Nothing due today. <Link to="/team/work">See everything on your plate</Link>.</Empty>
  return (
    <ul className="tm-prio">
      {tasks.map((task) => (
        <li key={task.id} className="tm-prio-task">
          <input
            type="checkbox"
            className="tm-check"
            aria-label={`Mark “${task.title}” done`}
            disabled={busy}
            onChange={async () => {
              if (await run(`/api/v1/team/tasks/${task.id}/`, { status: 'done' }, 'PATCH')) onDone()
            }}
          />
          <span className="tm-task">
            <strong>
              {task.priority === 'high' && <span className="tm-flag" title="High priority" />}
              {task.title}
            </strong>
            <span className="pt-muted pt-small">
              {[task.project || task.client, task.overdue ? `was due ${formatDate(task.due_date, false)}` : 'due today'].filter(Boolean).join(' · ')}
            </span>
          </span>
        </li>
      ))}
    </ul>
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
