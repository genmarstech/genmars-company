import { useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { ProgressBar } from '../portal/Projects'
import { Empty, Loading, Panel, StatusBadge, TeamLayout } from '../portal/PortalLayout'
import { formatDate, kes, timeAgo, useApi } from '../portal/useApi'
import { hm, useMutation } from './shared'
import { TaskPanel } from './Tasks'
import type { ActivityEvent, ClientNote, ClientOverview } from './types'

const KIND_LABEL: Record<ActivityEvent['kind'], string> = {
  account: 'Account',
  lead: 'Brief',
  order: 'Order',
  project: 'Project',
  milestone: 'Milestone',
  invoice: 'Invoice',
  payment: 'Payment',
  message: 'Message',
  note: 'Note',
  task: 'Task',
}

const FILTERS: { label: string; kinds: ActivityEvent['kind'][] | null }[] = [
  { label: 'Everything', kinds: null },
  { label: 'Work', kinds: ['order', 'project', 'milestone', 'task'] },
  { label: 'Money', kinds: ['invoice', 'payment'] },
  { label: 'Conversations', kinds: ['message', 'note', 'lead'] },
]

export function ClientDetail({ id }: { id: string }) {
  const { data, error } = useApi<ClientOverview>(`/api/v1/team/clients/${id}/overview/`)
  const p = data?.profile

  return (
    <TeamLayout
      title={data?.full_name ?? 'Client'}
      subtitle={data ? [p?.company_name, p?.industry].filter(Boolean).join(' · ') || data.email : undefined}
      actions={
        data && (
          <>
            <Link to={`/team/messages?client=${data.id}`} className="btn btn--sm btn--ghost">
              Message
            </Link>
            <Link to={`/team/projects?new=1&client=${data.id}`} className="btn btn--sm">
              New project
            </Link>
          </>
        )
      }
    >
      <Link to="/team/clients" className="pt-back">
        ← All clients
      </Link>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="pt-stats">
            <Money label="Invoiced" value={kes(data.invoiced)} />
            <Money label="Paid" value={kes(data.paid)} />
            <Money label="Outstanding" value={kes(data.outstanding)} note={Number(data.overdue) ? `${kes(data.overdue)} overdue` : undefined} bad={!!Number(data.overdue)} />
            <Money label="Time spent" value={hm(data.minutes)} note={`${data.projects.length} project${data.projects.length === 1 ? '' : 's'}`} />
          </div>

          <div className="pt-detail tm-client">
            <div className="pt-side-col">
              <Panel title="Contact">
                <dl className="pt-info">
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${data.email}`}>{data.email}</a>
                  </dd>
                  <dt>Phone</dt>
                  <dd>{data.phone_number ? <a href={`tel:${data.phone_number}`}>{data.phone_number}</a> : '—'}</dd>
                  {p?.contact_method && (
                    <>
                      <dt>Prefers</dt>
                      <dd>{p.contact_method}</dd>
                    </>
                  )}
                  {p?.job_title && (
                    <>
                      <dt>Role</dt>
                      <dd>{p.job_title}</dd>
                    </>
                  )}
                  {p?.company_size && (
                    <>
                      <dt>Team size</dt>
                      <dd>{p.company_size}</dd>
                    </>
                  )}
                  {p?.website && (
                    <>
                      <dt>Website</dt>
                      <dd>
                        <a href={p.website} target="_blank" rel="noopener noreferrer">
                          {p.website.replace(/^https?:\/\//, '')}
                        </a>
                      </dd>
                    </>
                  )}
                  <dt>Client since</dt>
                  <dd>{formatDate(data.date_joined)}</dd>
                </dl>
                {p?.goals && <p className="tm-goals">“{p.goals}”</p>}
              </Panel>

              <Notes client={data.id} />

              <Panel title="Projects">
                {data.projects.length === 0 ? (
                  <Empty>No projects yet.</Empty>
                ) : (
                  <ul className="tm-prio">
                    {data.projects.map((pr) => (
                      <li key={pr.id}>
                        <Link to={`/team/projects/${pr.id}`}>
                          <strong>{pr.name}</strong>
                          <span className="pt-muted pt-small">
                            {pr.status_label}
                            {pr.due_date ? ` · due ${formatDate(pr.due_date, false)}` : ''}
                          </span>
                        </Link>
                        <span className="tm-progress-cell">
                          <ProgressBar value={pr.progress} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <TaskPanel client={data.id} />
            </div>

            <Activity client={data.id} />
          </div>
        </>
      )}
    </TeamLayout>
  )
}

function Money({ label, value, note, bad }: { label: string; value: string; note?: string; bad?: boolean }) {
  return (
    <div className="pt-stat">
      <span className="pt-stat-label">{label}</span>
      <span className="pt-stat-value tm-money">{value}</span>
      {note && <span className={`pt-stat-note${bad ? ' tm-bad' : ''}`}>{note}</span>}
    </div>
  )
}

function Notes({ client }: { client: number }) {
  const { data, error, reload } = useApi<ClientNote[]>(`/api/v1/team/notes/?client=${client}`)
  const { busy, message, run } = useMutation()
  const [body, setBody] = useState('')

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    if (await run('/api/v1/team/notes/', { client, body: body.trim() })) {
      setBody('')
      reload()
    }
  }

  return (
    <Panel title="Team notes">
      <p className="pt-muted pt-small tm-private">
        <Icon name="shield" size={14} /> Only the team sees these.
      </p>
      <form className="tm-note-form" onSubmit={add}>
        <label className="sr-only" htmlFor="note-body">
          New note
        </label>
        <textarea
          id="note-body"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Decision maker is the MD. Pays on the 25th."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(e)
          }}
        />
        <button type="submit" className="btn btn--sm" disabled={busy || !body.trim()}>
          Add note
        </button>
      </form>
      {message && <p className="pt-error">{message}</p>}
      {!data ? (
        <Loading error={error} />
      ) : (
        data.length > 0 && (
          <ul className="tm-notes">
            {data.map((n) => (
              <li key={n.id} className={n.pinned ? 'is-pinned' : ''}>
                <p>{n.body}</p>
                <span className="tm-note-meta">
                  {n.pinned && <StatusBadge tone="blue">Pinned</StatusBadge>}
                  <span className="pt-muted pt-small">
                    {n.author_name || 'Someone'} · {timeAgo(n.created_at)}
                  </span>
                  <button type="button" className="tm-link-btn" disabled={busy} onClick={async () => (await run(`/api/v1/team/notes/${n.id}/`, { pinned: !n.pinned }, 'PATCH')) && reload()}>
                    {n.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  {n.is_mine && (
                    <button type="button" className="tm-link-btn tm-danger" disabled={busy} onClick={async () => (await run(`/api/v1/team/notes/${n.id}/`, {}, 'DELETE')) && reload()}>
                      Delete
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </Panel>
  )
}

function Activity({ client }: { client: number }) {
  const { data, error } = useApi<ActivityEvent[]>(`/api/v1/team/clients/${client}/activity/`)
  const [filter, setFilter] = useState(0)
  const kinds = FILTERS[filter].kinds
  const events = data?.filter((e) => !kinds || kinds.includes(e.kind)) ?? []

  // group by calendar day
  const days: [string, ActivityEvent[]][] = []
  for (const e of events) {
    const key = new Date(e.at).toDateString()
    const last = days[days.length - 1]
    if (last && last[0] === key) last[1].push(e)
    else days.push([key, [e]])
  }

  return (
    <Panel
      title="History"
      action={
        <div className="tm-seg" role="group" aria-label="Show">
          {FILTERS.map((f, i) => (
            <button key={f.label} type="button" aria-pressed={i === filter} onClick={() => setFilter(i)}>
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {!data ? (
        <Loading error={error} />
      ) : events.length === 0 ? (
        <Empty>Nothing here yet.</Empty>
      ) : (
        <ol className="tm-history">
          {days.map(([key, list]) => (
            <li key={key}>
              <h3>{formatDate(list[0].at)}</h3>
              <ul>
                {list.map((e, i) => {
                  const body = (
                    <>
                      <span className={`tm-kind tm-kind--${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                      <span className="tm-history-text">
                        <strong>{e.title}</strong>
                        {e.detail && <span className="pt-muted pt-small">{e.detail}</span>}
                      </span>
                      {!e.all_day && <time className="pt-muted pt-small">{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>}
                    </>
                  )
                  return (
                    <li key={`${e.kind}-${e.at}-${i}`}>
                      {e.link ? (
                        <Link to={e.link} className="tm-history-row">
                          {body}
                        </Link>
                      ) : (
                        <div className="tm-history-row">{body}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
