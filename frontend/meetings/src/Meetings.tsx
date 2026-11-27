import { useMemo, useState, type FormEvent } from 'react'
import { ProjectOptions } from './ui/ProjectOptions'
import { Link } from './ui/Link'
import { Empty, Loading, Panel, StatusBadge } from './ui/Layout'
import { formatDate, useApi } from './useApi'
import { Field } from './ui/Field'
import {
  CATEGORIES, clock, reportTone, statusTone, timeRange, viewerZone,
  useDirectory, type ActionItem, type GoogleStatus, type MeetingDetail, type MeetingRow, type MeetingsOverview,
} from './meetingTypes'
import { formData, hm, isoDate, useMutation } from './shared'

export function GooglePanel({ status, onChange }: { status: GoogleStatus; onChange: () => void }) {
  const { busy, message, run } = useMutation()
  const [opening, setOpening] = useState(false)
  const connect = async () => {
    setOpening(true)
    const res = (await run('/api/v1/integrations/google/connect/', undefined, 'GET')) as { url?: string } | null
    if (res?.url) window.location.href = res.url
    else setOpening(false)
  }
  const disconnect = async () => {
    if (await run('/api/v1/integrations/google/disconnect/', {})) onChange()
  }
  const tone = status.connected ? 'green' : status.status === 'expired' ? 'amber' : 'gray'

  return (
    <Panel title="Google Meet & Calendar" action={<StatusBadge tone={tone}>{status.status_label}</StatusBadge>}>
      {message && <p className="pt-error">{message}</p>}
      {!status.configured ? (
        <p className="pt-muted pt-small">The server doesn’t have the Google OAuth client yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to backend/.env and restart the API.</p>
      ) : status.account_email && status.status !== 'disconnected' ? (
        <dl className="pt-info mt-google">
          <dt>Account</dt>
          <dd>{status.account_email}</dd>
          <dt>Connected by</dt>
          <dd>
            {status.connected_by || '—'}
            {status.connected_at && <span className="pt-muted pt-small pt-block">{formatDate(status.connected_at)}</span>}
          </dd>
          <dt>Access</dt>
          <dd className="pt-small">Calendar events, Meet spaces, meeting records</dd>
        </dl>
      ) : (
        <p className="pt-muted pt-small">Connect the company Google account to create Meet links, send Calendar invites, and bring back attendance and transcripts after each call.</p>
      )}
      {status.last_error && <p className="pt-small tm-bad mt-gap">{status.last_error}</p>}
      {status.configured && (
        status.can_manage ? (
          <div className="tm-form-actions mt-gap">
            {status.status !== 'connected' && (
              <button type="button" className="btn btn--sm" disabled={opening} onClick={connect}>
                {opening ? 'Opening Google…' : status.status === 'expired' ? 'Reconnect Google' : 'Connect Google'}
              </button>
            )}
            {status.status !== 'disconnected' && (
              <button type="button" className="tm-link-btn tm-danger" disabled={busy} onClick={disconnect}>
                Disconnect
              </button>
            )}
          </div>
        ) : (
          !status.connected && <p className="pt-muted pt-small mt-gap">Ask an owner to connect Google.</p>
        )
      )}
    </Panel>
  )
}

export function MyActions({ items, onChange }: { items: ActionItem[]; onChange: () => void }) {
  const { busy, run } = useMutation()
  const today = isoDate()
  if (items.length === 0) return <Empty>Nothing from meetings waiting on you.</Empty>
  return (
    <ul className="tm-tasks">
      {items.map((a) => (
        <li key={a.id} className="tm-task-row">
          <input
            type="checkbox"
            className="tm-check"
            disabled={busy}
            aria-label={`Mark “${a.title}” done`}
            onChange={async () => {
              if (await run(`/api/v1/meetings/${a.meeting}/actions/${a.id}/`, { status: 'done' }, 'PATCH')) onChange()
            }}
          />
          <Link to={`/${a.meeting}`} className="tm-task-main">
            <strong>{a.title}</strong>
            <span className="pt-muted pt-small">From {a.meeting_title}</span>
          </Link>
          <span className={`tm-due${a.due_date && a.due_date < today ? ' tm-bad' : ''}`}>{a.due_date ? (a.due_date === today ? 'Today' : formatDate(a.due_date, false)) : ''}</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- calendar

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function MeetingCalendar() {
  const [month, setMonth] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get('month')?.match(/^(\d{4})-(\d{2})$/)
    const d = new Date()
    return wanted ? new Date(Number(wanted[1]), Number(wanted[2]) - 1, 1) : new Date(d.getFullYear(), d.getMonth(), 1)
  })
  // the grid runs Monday to Sunday and always shows whole weeks
  const first = new Date(month)
  first.setDate(1 - ((month.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first)
    d.setDate(first.getDate() + i)
    return d
  })
  const { data } = useApi<MeetingRow[]>(`/api/v1/meetings/?from=${isoDate(cells[0])}&to=${isoDate(cells[41])}`)
  const byDay = useMemo(() => {
    const map = new Map<string, MeetingRow[]>()
    for (const m of [...(data ?? [])].sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))) {
      const key = isoDate(new Date(m.scheduled_start))
      map.set(key, [...(map.get(key) ?? []), m])
    }
    return map
  }, [data])
  const today = isoDate()
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const weeks = cells[35].getMonth() === month.getMonth() ? 6 : 5

  return (
    <Panel
      title={month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
      action={
        <span className="tm-week-nav">
          <button type="button" className="pt-icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
            ‹
          </button>
          <button type="button" className="tm-link-btn" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Today
          </button>
          <button type="button" className="pt-icon-btn" aria-label="Next month" onClick={() => shift(1)}>
            ›
          </button>
        </span>
      }
    >
      <div className="mt-cal" role="grid" aria-label="Meetings calendar">
        {WEEKDAYS.map((d) => (
          <span key={d} className="mt-cal-head" role="columnheader">
            {d}
          </span>
        ))}
        {cells.slice(0, weeks * 7).map((d) => {
          const key = isoDate(d)
          const list = byDay.get(key) ?? []
          return (
            <div key={key} role="gridcell" className={`mt-cal-day${d.getMonth() !== month.getMonth() ? ' is-out' : ''}${key === today ? ' is-today' : ''}`}>
              <span className="mt-cal-num">{d.getDate()}</span>
              {list.slice(0, 3).map((m) => (
                <Link key={m.id} to={`/${m.id}`} className={`mt-cal-item mt-cal-item--${m.status}`} title={`${clock(m.scheduled_start)} ${m.title}`}>
                  <span className="mt-cal-time">{clock(m.scheduled_start)}</span> {m.title}
                </Link>
              ))}
              {list.length > 3 && <span className="pt-muted mt-cal-more">+{list.length - 3} more</span>}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------- history

export function History() {
  const initial = new URLSearchParams(window.location.search).get('q') ?? ''
  const [q, setQ] = useState(initial)
  const [term, setTerm] = useState(initial)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [project, setProject] = useState('')
  const [mine, setMine] = useState(false)
  const directory = useDirectory()
  const query = new URLSearchParams({ view: 'history' })
  if (term) query.set('q', term)
  if (status) query.set('status', status)
  if (category) query.set('category', category)
  if (project) query.set('project', project)
  if (mine) query.set('mine', '1')
  const { data, error } = useApi<MeetingRow[]>(`/api/v1/meetings/?${query}`)

  return (
    <Panel title="Meeting history">
      <form
        className="mt-filters"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setTerm(q.trim())
        }}
      >
        <input className="tm-search" type="search" value={q} placeholder="Search titles, notes, decisions, people" aria-label="Search meetings" onChange={(e) => setQ(e.target.value)} onBlur={() => setTerm(q.trim())} />
        <label className="pt-filter">
          <span className="sr-only">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="pt-filter">
          <span className="sr-only">Type</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Any type</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="pt-filter">
          <span className="sr-only">Project</span>
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Any project</option>
            <ProjectOptions projects={directory?.projects} detail={false} />
          </select>
        </label>
        <label className="tm-checkline">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only mine
        </label>
      </form>
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <Empty>{term || status || category || project || mine ? 'No meetings match.' : 'Finished meetings will be listed here with their records.'}</Empty>
      ) : (
        <div className="pt-table-wrap">
          <table className="pt-table pt-stack">
            <thead>
              <tr>
                <th scope="col">Meeting</th>
                <th scope="col">When</th>
                <th scope="col">Organizer</th>
                <th scope="col" className="pt-num">People</th>
                <th scope="col">Record</th>
                <th scope="col" className="pt-num">Open actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td data-label="Meeting">
                    <Link to={`/${m.id}`} className="mt-cell-link">
                      <strong>{m.title}</strong>
                      <span className="pt-muted pt-small">
                        {[m.project_name || m.category_label, m.decision_count ? `${m.decision_count} decision${m.decision_count === 1 ? '' : 's'}` : '', m.has_transcript ? 'transcript' : ''].filter(Boolean).join(' · ')}
                      </span>
                    </Link>
                  </td>
                  <td data-label="When" className="pt-small tm-nowrap">
                    {formatDate(m.scheduled_start)}
                    <span className="pt-muted pt-block">{timeRange(m)}</span>
                  </td>
                  <td data-label="Organizer" className="pt-small">{m.organizer_name || '—'}</td>
                  <td data-label="People" className="pt-num">{m.participant_count}</td>
                  <td data-label="Record">
                    {m.status === 'cancelled' ? <StatusBadge tone={statusTone[m.status]}>{m.status_label}</StatusBadge> : <StatusBadge tone={reportTone[m.report_status]}>{m.report_label}</StatusBadge>}
                  </td>
                  <td data-label="Open actions" className="pt-num">{m.open_actions || <span className="pt-muted">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

export function Insights({ o }: { o: MeetingsOverview }) {
  const i = o.insights
  const pct = (n: number | null) => (n === null ? '—' : `${n}%`)
  return (
    <Panel title="This month at a glance">
      <dl className="mt-insights">
        <div>
          <dt>Time in meetings</dt>
          <dd>{hm(i.minutes_this_month)}</dd>
        </div>
        <div>
          <dt>Finished meetings with an approved record</dt>
          <dd>{pct(i.record_rate)}</dd>
        </div>
        <div>
          <dt>Finished meetings with a transcript</dt>
          <dd>{pct(i.transcript_rate)}</dd>
        </div>
        <div>
          <dt>Action items done</dt>
          <dd>
            {i.actions_done_this_month} of {i.actions_this_month}
          </dd>
        </div>
        <div>
          <dt>Meetings linked to a project</dt>
          <dd>{i.linked_to_projects}</dd>
        </div>
      </dl>
    </Panel>
  )
}

// ---------------------------------------------------------------- scheduling

export function ScheduleForm({ google, onSaved, onCancel }: { google?: GoogleStatus; onSaved: (m: MeetingDetail) => void; onCancel: () => void }) {
  const { busy, errors, message, run } = useMutation()
  const directory = useDirectory()
  const [team, setTeam] = useState<number[]>([])
  const [start, setStart] = useState('')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = formData(e)
    const startAt = f.start ? new Date(f.start) : null
    const mins = Number(f.length || 30)
    const body = {
      title: f.title,
      description: f.description ?? '',
      category: f.category,
      project: f.project ? Number(f.project) : null,
      scheduled_start: startAt?.toISOString(),
      scheduled_end: startAt ? new Date(startAt.getTime() + mins * 60_000).toISOString() : null,
      time_zone: viewerZone(),
      team,
      guests: (f.guests ?? '').split(/[\s,;]+/).filter(Boolean),
      agenda_lines: (f.agenda ?? '').split('\n').map((l) => l.trim()).filter(Boolean),
      send_invites: f.send_invites === 'on',
    }
    const saved = (await run('/api/v1/meetings/', body)) as MeetingDetail | null
    if (saved) onSaved(saved)
  }

  return (
    <form className="tm-form" onSubmit={submit}>
      {message && <p className="pt-error tm-wide">{message}</p>}
      <Field label="Title" error={errors.title} wide>
        <input name="title" required placeholder="Sprint review with the client" autoFocus />
      </Field>
      <Field label="Starts" error={errors.scheduled_start}>
        <input name="start" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="Length" error={errors.scheduled_end}>
        <select name="length" defaultValue="30">
          {[15, 30, 45, 60, 90, 120].map((n) => (
            <option key={n} value={n}>
              {hm(n)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Type">
        <select name="category" defaultValue="internal">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Project" error={errors.project}>
        <select name="project" defaultValue="">
          <option value="">None</option>
          <ProjectOptions projects={directory?.projects} />
        </select>
      </Field>
      <fieldset className="mt-people tm-wide">
        <legend>Team</legend>
        {directory?.staff.map((s) => (
          <label key={s.id} className="mt-person-pick">
            <input
              type="checkbox"
              checked={team.includes(s.id)}
              onChange={(e) => setTeam((t) => (e.target.checked ? [...t, s.id] : t.filter((x) => x !== s.id)))}
            />
            {s.full_name}
          </label>
        ))}
      </fieldset>
      <Field label="Guests (emails)" error={errors.guests} wide>
        <input name="guests" placeholder="client@company.com, partner@agency.com" />
      </Field>
      <Field label="Agenda (one item per line)" wide>
        <textarea name="agenda" rows={3} placeholder={'Demo of the new checkout\nOpen questions\nNext steps'} />
      </Field>
      <Field label="Description" wide>
        <textarea name="description" rows={2} placeholder="What this meeting is for. Guests see this in the invite." />
      </Field>
      <div className="tm-form-actions tm-wide">
        <button type="submit" className="btn btn--sm" disabled={busy}>
          {busy ? 'Scheduling…' : 'Schedule'}
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        {google?.connected ? (
          <label className="tm-checkline">
            <input type="checkbox" name="send_invites" defaultChecked /> Send Calendar invites with the Meet link
          </label>
        ) : (
          <span className="pt-muted pt-small">Google isn’t connected, so this is saved without a Meet link or invites.</span>
        )}
      </div>
    </form>
  )
}
