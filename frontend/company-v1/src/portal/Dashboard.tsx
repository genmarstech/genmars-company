import { useSession } from '../auth/session'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, PortalLayout } from './PortalLayout'
import { formatDate, kes, timeAgo, useApi, type Summary } from './useApi'
import { ProgressBar } from './Projects'

export function Dashboard() {
  const { user } = useSession()
  const { data, error } = useApi<Summary>('/api/v1/portal/summary/')

  return (
    <PortalLayout
      title="Dashboard"
      subtitle={`Welcome back, ${user?.full_name.split(' ')[0] ?? ''}. Here’s where your projects stand.`}
      actions={
        <Link to="/portal/orders/new" className="btn btn--sm">
          Order a service <Icon name="arrow" size={16} />
        </Link>
      }
    >
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          {data.quotes_waiting.map((q) => (
            <Link key={q.id} to={`/portal/orders/${q.id}`} className="pt-panel od-callout">
              <span>
                <strong>Your quote for {q.service.toLowerCase()} is ready</strong>
                <span className="pt-muted pt-small">
                  {kes(q.price)}
                  {q.valid_until && ` · valid until ${formatDate(q.valid_until)}`}
                </span>
              </span>
              <span className="pt-more">
                Review <Icon name="arrow" size={14} />
              </span>
            </Link>
          ))}
          <div className="pt-stats">
            <Stat label="Active projects" value={data.active_projects} />
            <Stat label="Open orders" value={data.open_orders} note={data.quotes_waiting.length ? `${data.quotes_waiting.length} quote${data.quotes_waiting.length > 1 ? 's' : ''} to review` : undefined} />
            <Stat label="Invoices" value={data.invoices} note={Number(data.unpaid_total) ? `${kes(data.unpaid_total)} due` : 'All paid'} />
            <Stat label="Unread messages" value={data.unread_messages} />
          </div>

          {data.products?.length > 0 && (
            <Panel title="Apps from Genmars">
              <ul className="pt-list pt-apps">
                {data.products.map((p) => (
                  <li key={p.id}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="pt-proj-row">
                      <span className="pt-proj-icon">
                        <Icon name="layout" size={16} />
                      </span>
                      <span className="pt-proj-main">
                        <strong>{p.name}</strong>
                        {p.summary && <span className="pt-muted pt-small">{p.summary}</span>}
                      </span>
                      <span className="pt-more">
                        Open <Icon name="arrow" size={14} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

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
                  <Link to="/portal/orders/new">Order a service</Link>
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
