import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { services } from '../data/site'
import { Empty, Loading, Panel, PortalLayout, StatusBadge } from './PortalLayout'
import { formatDate, kes, useApi, type Milestone, type Project, type ProjectDetail as Detail } from './useApi'

export function ProgressBar({ value }: { value: number }) {
  return (
    <span className="pt-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </span>
  )
}

const healthTone: Record<string, string> = { on_track: 'green', at_risk: 'amber', off_track: 'red' }
const statusTone: Record<string, string> = { completed: 'green', on_hold: 'gray', in_review: 'blue', in_progress: 'blue', planning: 'gray' }

export function ProjectsList() {
  const { data, error } = useApi<Project[]>('/api/v1/portal/projects/')

  return (
    <PortalLayout title="Projects" subtitle="Everything we’re building with you.">
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <Panel>
          <Empty>
            You don’t have any projects yet. <Link to="/portal/requests">Send us a request</Link> and we’ll set one up.
          </Empty>
        </Panel>
      ) : (
        <div className="pt-cards">
          {data.map((p) => (
            <Link key={p.id} to={`/portal/projects/${p.id}`} className="pt-panel pt-proj-card">
              <div className="pt-proj-card-top">
                <StatusBadge tone={statusTone[p.status] ?? 'gray'}>{p.status_label}</StatusBadge>
                {p.status !== 'completed' && <StatusBadge tone={healthTone[p.health] ?? 'gray'}>{p.health_label}</StatusBadge>}
              </div>
              <h2>{p.name}</h2>
              {p.summary && <p className="pt-muted">{p.summary}</p>}
              <div className="pt-proj-card-progress">
                <ProgressBar value={p.progress} />
                <span>{p.progress}%</span>
              </div>
              <span className="pt-muted pt-small">Due {formatDate(p.due_date)}</span>
            </Link>
          ))}
        </div>
      )}
    </PortalLayout>
  )
}

export function ProjectDetail({ id }: { id: string }) {
  const { data, error } = useApi<Detail>(`/api/v1/portal/projects/${id}/`)
  const serviceName = services.find((s) => s.slug === data?.service)?.title

  return (
    <PortalLayout
      title={data?.name ?? 'Project'}
      subtitle={data?.summary || serviceName}
      actions={
        data && (
          <>
            {data.status !== 'completed' && <StatusBadge tone={healthTone[data.health] ?? 'gray'}>{data.health_label}</StatusBadge>}
            <Link to={`/portal/messages?project=${data.id}`} className="btn btn--sm btn--ghost">
              Message the team
            </Link>
          </>
        )
      }
    >
      <Link to="/portal/projects" className="pt-back">
        ← All projects
      </Link>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="pt-detail">
          <Panel title="Project timeline">
            {data.milestones.length === 0 ? (
              <Empty>We’ll add the milestones once the plan is agreed.</Empty>
            ) : (
              <ol className="pt-timeline">
                {data.milestones.map((m) => (
                  <TimelineItem key={m.id} m={m} />
                ))}
              </ol>
            )}
          </Panel>

          <div className="pt-side-col">
            <Panel title="Project info">
              <dl className="pt-info">
                <dt>Status</dt>
                <dd>{data.status_label}</dd>
                <dt>Progress</dt>
                <dd className="pt-info-progress">
                  <ProgressBar value={data.progress} /> {data.progress}%
                </dd>
                <dt>Start date</dt>
                <dd>{formatDate(data.start_date)}</dd>
                <dt>Estimated delivery</dt>
                <dd>{formatDate(data.due_date)}</dd>
                <dt>Budget</dt>
                <dd>{kes(data.budget)}</dd>
              </dl>
            </Panel>
            <Panel title="Files & links">
              {data.links.length === 0 ? (
                <Empty>Designs, previews and documents will appear here.</Empty>
              ) : (
                <ul className="pt-links">
                  {data.links.map((l) => (
                    <li key={l.id}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer">
                        <Icon name="link2" size={16} /> {l.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </PortalLayout>
  )
}

function TimelineItem({ m }: { m: Milestone }) {
  return (
    <li className={`pt-tl pt-tl--${m.status}`}>
      <span className="pt-tl-dot" aria-hidden="true">
        {m.status === 'done' && <Icon name="check" size={13} strokeWidth={3} />}
      </span>
      <div>
        <strong>{m.title}</strong>
        {m.description && <p className="pt-muted">{m.description}</p>}
        <span className="pt-muted pt-small">
          {m.status === 'done'
            ? `Completed · ${formatDate(m.completed_at)}`
            : `${m.status_label}${m.due_date ? ` · Due ${formatDate(m.due_date)}` : ''}`}
        </span>
      </div>
    </li>
  )
}
