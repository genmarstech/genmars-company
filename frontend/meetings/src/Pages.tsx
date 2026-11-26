import { useState, type ReactNode } from 'react'
import { GooglePanel, History, Insights, MeetingCalendar } from './Meetings'
import { GOOGLE_RESULT, TEAM_URL, useDirectory, type ActionItem, type GoogleStatus, type MeetingsOverview, type Point } from './meetingTypes'
import { isoDate, useMutation } from './shared'
import { Empty, Layout, Loading, Panel, StatusBadge } from './ui/Layout'
import { Link } from './ui/Link'
import { formatDate, useApi } from './useApi'

export function CalendarPage() {
  return (
    <Layout title="Calendar" subtitle="Every meeting by day. Open one to see its record.">
      <MeetingCalendar />
    </Layout>
  )
}

export function RecordsPage() {
  return (
    <Layout title="Meeting records" subtitle="Every finished meeting and its record. Search titles, notes, decisions, action items or people.">
      <History />
    </Layout>
  )
}

export function InsightsPage() {
  const { data, error } = useApi<MeetingsOverview>('/api/v1/meetings/overview/')
  return (
    <Layout title="Insights" subtitle="Whether meetings lead to records, decisions and finished work.">
      {data ? <Insights o={data} /> : <Loading error={error} />}
    </Layout>
  )
}

export function SettingsPage() {
  const { data, error, reload } = useApi<GoogleStatus>('/api/v1/integrations/google/status/')
  const result = GOOGLE_RESULT[new URLSearchParams(window.location.search).get('google') ?? '']
  return (
    <Layout title="Google Meet" subtitle="The Google account that creates Meet links and Calendar invites for the team.">
      {result && <p className={`mt-banner mt-banner--${result.tone}`} role="status">{result.text}</p>}
      <div className="mh-narrow">{data ? <GooglePanel status={data} onChange={reload} /> : <Loading error={error} />}</div>
    </Layout>
  )
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <span className="tm-seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </span>
  )
}

type DecisionRow = Point & { meeting: number; meeting_title: string; meeting_date: string; project_name: string }

const DECISION_TONE: Record<string, string> = { approved: 'green', proposed: 'blue', rejected: 'red' }

/** What the company has decided, across every meeting, with where each decision came from. */
export function DecisionsPage() {
  const [status, setStatus] = useState<'approved' | 'proposed' | 'rejected' | ''>('approved')
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const query = new URLSearchParams()
  if (status) query.set('status', status)
  if (term) query.set('q', term)
  const { data, error, reload } = useApi<DecisionRow[]>(`/api/v1/meetings/decisions/?${query}`)
  const { busy, message, run } = useMutation()

  return (
    <Layout title="Decisions" subtitle="What was agreed in meetings, who owns it, and where it was decided. Proposals become decisions once approved.">
      <Panel>
        <form
          className="mt-filters"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            setTerm(q.trim())
          }}
        >
          <Seg label="Status" value={status} onChange={setStatus} options={[['approved', 'Approved'], ['proposed', 'Waiting for approval'], ['rejected', 'Rejected'], ['', 'All']]} />
          <input className="tm-search" type="search" value={q} placeholder="Search decisions" aria-label="Search decisions" onChange={(e) => setQ(e.target.value)} onBlur={() => setTerm(q.trim())} />
        </form>
        {message && <p className="pt-error">{message}</p>}
        {!data ? (
          <Loading error={error} />
        ) : data.length === 0 ? (
          <Empty>{status === 'proposed' ? 'Nothing waiting for approval.' : 'No decisions here yet. They’re added on each meeting’s page.'}</Empty>
        ) : (
          <ul className="mt-points mt-decisions">
            {data.map((d) => (
              <li key={d.id} className="mt-point">
                <div className="mt-point-head">
                  <strong>{d.title}</strong>
                  <StatusBadge tone={DECISION_TONE[d.status] ?? 'gray'}>{d.status_label}</StatusBadge>
                </div>
                {d.detail && <p className="pt-small mt-point-detail">{d.detail}</p>}
                <div className="tm-form-actions pt-small">
                  <Link to={`/${d.meeting}`}>{d.meeting_title}</Link>
                  <span className="pt-muted">{formatDate(d.meeting_date)}</span>
                  {d.project_name && <span className="pt-muted">{d.project_name}</span>}
                  {d.owner_name && <span className="pt-muted">Owner: {d.owner_name}</span>}
                  {d.approved_by_name && <span className="pt-muted">Approved by {d.approved_by_name}</span>}
                  {d.status === 'proposed' && (
                    <button type="button" className="tm-link-btn tm-push" disabled={busy} onClick={async () => (await run(`/api/v1/meetings/${d.meeting}/points/${d.id}/approve/`, {})) && reload()}>
                      Approve
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Layout>
  )
}

/** Follow-ups from every meeting: who owns what, and when it's due. */
export function ActionsPage() {
  const directory = useDirectory()
  const [who, setWho] = useState('mine')
  const [state, setState] = useState<'open' | 'done' | ''>('open')
  const query = new URLSearchParams()
  if (who === 'mine') query.set('mine', '1')
  else if (who) query.set('assignee', who)
  if (state) query.set('state', state)
  const { data, error, reload } = useApi<(ActionItem & { task_status: string | null })[]>(`/api/v1/meetings/actions/?${query}`)
  const { busy, message, run } = useMutation()
  const today = isoDate()

  return (
    <Layout
      title="Action items"
      subtitle="Follow-ups agreed in meetings. Ones made into tasks also show on the team’s task list."
      actions={<a href={`${TEAM_URL}/team/work`} className="btn btn--sm btn--ghost">Team task list</a>}
    >
      <Panel>
        <div className="mt-filters">
          <Seg label="Show" value={state} onChange={setState} options={[['open', 'Open'], ['done', 'Done'], ['', 'All']]} />
          <label className="pt-filter">
            <span className="sr-only">Whose</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="mine">Mine</option>
              <option value="">Everyone</option>
              {directory?.staff
                .filter((s) => s.id !== directory.me.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {message && <p className="pt-error">{message}</p>}
        {!data ? (
          <Loading error={error} />
        ) : data.length === 0 ? (
          <Empty>{state === 'open' ? 'Nothing open. Every follow-up is done.' : 'No action items here.'}</Empty>
        ) : (
          <ul className="tm-tasks">
            {data.map((a) => (
              <li key={a.id} className={`tm-task-row${a.status === 'done' ? ' is-done' : ''}`}>
                <input
                  type="checkbox"
                  className="tm-check"
                  checked={a.status === 'done'}
                  disabled={busy}
                  aria-label={`Mark “${a.title}” ${a.status === 'done' ? 'not done' : 'done'}`}
                  onChange={async () => (await run(`/api/v1/meetings/${a.meeting}/actions/${a.id}/`, { status: a.status === 'done' ? 'todo' : 'done' }, 'PATCH')) && reload()}
                />
                <Link to={`/${a.meeting}`} className="tm-task-main">
                  <strong>
                    {a.priority === 'high' && <span className="tm-flag" title="High priority" />}
                    {a.title}
                  </strong>
                  <span className="pt-muted pt-small">{joinBits([who !== 'mine' && (a.assignee_name || 'Unassigned'), `From ${a.meeting_title}`, a.status === 'doing' && 'In progress', a.task && 'on the task list'])}</span>
                </Link>
                <span className={`tm-due${a.status !== 'done' && a.due_date && a.due_date < today ? ' tm-bad' : ''}`}>
                  {a.due_date ? (a.due_date === today ? 'Today' : formatDate(a.due_date, false)) : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Layout>
  )
}

function joinBits(bits: (string | false | null | number)[]): ReactNode {
  return bits.filter(Boolean).join(' · ')
}
