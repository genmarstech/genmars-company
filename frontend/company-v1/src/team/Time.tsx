import { useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, TeamLayout } from '../portal/PortalLayout'
import { formatDate, kes, useApi } from '../portal/useApi'
import { Field } from './Field'
import { hm, isoDate, parseDuration, useMutation, useOnTimeLogged } from './shared'
import { startTimer, useTimer } from './timerStore'
import type { Profitability, Staff, Task, TeamProject, TimeEntry } from './types'

function monday(offsetWeeks: number) {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day + offsetWeeks * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

export function TimePage() {
  const [week, setWeek] = useState(0)
  const start = monday(week)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const entries = useApi<TimeEntry[]>(`/api/v1/team/time/?mine=1&from=${isoDate(start)}&to=${isoDate(end)}`)
  const profit = useApi<Profitability>('/api/v1/team/profitability/')
  const reloadAll = () => {
    entries.reload()
    profit.reload()
  }
  useOnTimeLogged(entries.reload)

  const total = entries.data?.reduce((t, e) => t + e.minutes, 0) ?? 0
  const billable = entries.data?.filter((e) => e.billable).reduce((t, e) => t + e.minutes, 0) ?? 0
  const byDay = new Map<string, TimeEntry[]>()
  entries.data?.forEach((e) => byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]))

  return (
    <TeamLayout title="Time & profit" subtitle="Log your hours, and see what each project earns after the team’s time.">
      <div className="pt-two tm-time-top">
        <Panel title="Log time">
          <LogTime onSaved={reloadAll} />
        </Panel>
        <Panel
          title={week === 0 ? 'Your week' : `Week of ${formatDate(isoDate(start), false)}`}
          action={
            <span className="tm-week-nav">
              <button type="button" className="pt-icon-btn" aria-label="Previous week" onClick={() => setWeek((w) => w - 1)}>
                <span className="tm-flip"><Icon name="arrow" size={14} /></span>
              </button>
              <button type="button" className="pt-icon-btn" aria-label="Next week" disabled={week >= 0} onClick={() => setWeek((w) => w + 1)}>
                <Icon name="arrow" size={14} />
              </button>
            </span>
          }
        >
          {!entries.data ? (
            <Loading error={entries.error} />
          ) : (
            <>
              <p className="tm-week-total">
                <strong>{hm(total)}</strong>
                <span className="pt-muted pt-small">{total ? `${Math.round((billable / total) * 100)}% billable` : 'Nothing logged yet'}</span>
              </p>
              <WeekBars start={start} entries={entries.data} />
              {[...byDay.entries()].map(([day, list]) => (
                <div key={day} className="tm-day">
                  <h3>
                    {new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                    <span>{hm(list.reduce((t, e) => t + e.minutes, 0))}</span>
                  </h3>
                  <EntryList entries={list} onChange={reloadAll} />
                </div>
              ))}
            </>
          )}
        </Panel>
      </div>

      <h2 className="tm-section">Project profitability</h2>
      {!profit.data ? <Loading error={profit.error} /> : <ProfitTable data={profit.data} />}
      {profit.data && <Rates data={profit.data} onChange={profit.reload} />}
    </TeamLayout>
  )
}

function WeekBars({ start, entries }: { start: Date; entries: TimeEntry[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const key = isoDate(d)
    return { key, label: d.toLocaleDateString('en-GB', { weekday: 'narrow' }), minutes: entries.filter((e) => e.date === key).reduce((t, e) => t + e.minutes, 0) }
  })
  const max = Math.max(8 * 60, ...days.map((d) => d.minutes))
  const today = isoDate()
  return (
    <ol className="tm-weekbars" aria-label="Hours per day">
      {days.map((d) => (
        <li key={d.key} title={`${d.key}: ${hm(d.minutes)}`} data-today={d.key === today || undefined}>
          <span className="tm-weekbar">
            <span style={{ height: `${(d.minutes / max) * 100}%` }} />
          </span>
          <span className="tm-weekbar-label">{d.label}</span>
        </li>
      ))}
    </ol>
  )
}

export function EntryList({ entries, onChange, showUser = false }: { entries: TimeEntry[]; onChange: () => void; showUser?: boolean }) {
  const { busy, run } = useMutation()
  return (
    <ul className="tm-entries">
      {entries.map((e) => (
        <li key={e.id}>
          <span>
            <strong>{showUser ? e.user_name : e.project_name}</strong>
            <span className="pt-muted pt-small">
              {[e.task_title, e.note !== e.task_title && e.note, !e.billable && 'Not billable', showUser && formatDate(e.date, false)].filter(Boolean).join(' · ') || e.client_name}
            </span>
          </span>
          <span className="pt-num">{hm(e.minutes)}</span>
          {!showUser && (
            <button
              type="button"
              className="pt-icon-btn tm-quiet-btn"
              aria-label={`Remove ${hm(e.minutes)} on ${e.project_name}`}
              disabled={busy}
              onClick={async () => {
                if (await run(`/api/v1/team/time/${e.id}/`, {}, 'DELETE')) onChange()
              }}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function LogTime({ project, onSaved }: { project?: TeamProject; onSaved: () => void }) {
  const projects = useApi<TeamProject[]>(project ? null : '/api/v1/team/projects/')
  const [projectId, setProjectId] = useState<string>(project ? String(project.id) : '')
  const tasks = useApi<Task[]>(projectId ? `/api/v1/team/tasks/?project=${projectId}&open=1` : null)
  const { busy, errors, message, run } = useMutation()
  const [durationError, setDurationError] = useState('')
  const timer = useTimer()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const minutes = parseDuration(String(f.get('duration') ?? ''))
    if (!minutes) {
      setDurationError('Try 1:30, 1.5 or 45m.')
      return
    }
    setDurationError('')
    const ok = await run('/api/v1/team/time/', {
      project: Number(projectId),
      task: f.get('task') ? Number(f.get('task')) : null,
      date: f.get('date'),
      minutes,
      note: String(f.get('note') ?? '').trim(),
      billable: f.get('billable') === 'on',
    })
    if (ok) {
      ;(form.elements.namedItem('duration') as HTMLInputElement).value = ''
      ;(form.elements.namedItem('note') as HTMLInputElement).value = ''
      onSaved()
    }
  }

  const begin = (form: HTMLFormElement | null) => {
    if (!projectId || !form) return
    const f = new FormData(form)
    const task = tasks.data?.find((t) => String(t.id) === f.get('task'))
    const name = project?.name ?? projects.data?.find((p) => String(p.id) === projectId)?.name ?? 'Project'
    startTimer({ project: Number(projectId), task: task?.id, label: String(f.get('note') || task?.title || name) })
  }

  return (
    <form className="tm-form tm-form--compact" onSubmit={submit}>
      {message && <p className="pt-error tm-wide">{message}</p>}
      {!project && (
        <Field label="Project" error={errors.project} wide>
          <select name="project" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Choose a project</option>
            {projects.data
              ?.filter((p) => p.status !== 'completed')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.client_name}
                </option>
              ))}
          </select>
        </Field>
      )}
      {tasks.data && tasks.data.length > 0 && (
        <Field label="Task" error={errors.task} wide={!project}>
          <select name="task" defaultValue="">
            <option value="">No particular task</option>
            {tasks.data.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="How long" error={durationError || errors.minutes}>
        <input name="duration" placeholder="1:30" inputMode="decimal" />
      </Field>
      <Field label="Date" error={errors.date}>
        <input name="date" type="date" required defaultValue={isoDate()} max={isoDate()} />
      </Field>
      <Field label="What you did" wide>
        <input name="note" placeholder="Homepage layout and copy" maxLength={255} />
      </Field>
      <label className="tm-checkline tm-wide">
        <input type="checkbox" name="billable" defaultChecked /> Billable to the client
      </label>
      <div className="tm-form-actions tm-wide">
        <button type="submit" className="btn btn--sm" disabled={busy || !projectId}>
          {busy ? 'Saving…' : 'Log time'}
        </button>
        <button type="button" className="btn btn--sm btn--ghost" disabled={!projectId || !!timer} title={timer ? 'A timer is already running' : undefined} onClick={(e) => begin(e.currentTarget.form)}>
          Start timer
        </button>
      </div>
    </form>
  )
}

function ProfitTable({ data }: { data: Profitability }) {
  const rows = data.projects.filter((p) => Number(p.value) || p.minutes)
  if (rows.length === 0)
    return (
      <Panel>
        <Empty>Once projects have a budget or invoices and the team logs time, you’ll see what each one earns here.</Empty>
      </Panel>
    )
  const t = data.totals
  return (
    <Panel>
      <div className="pt-table-wrap">
        <table className="pt-table pt-stack tm-profit">
          <thead>
            <tr>
              <th scope="col">Project</th>
              <th scope="col" className="pt-num">Worth</th>
              <th scope="col" className="pt-num">Paid</th>
              <th scope="col" className="pt-num">Hours</th>
              <th scope="col" className="pt-num">Time cost</th>
              <th scope="col" className="pt-num">Profit</th>
              <th scope="col">Budget used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td data-label="Project">
                  <Link to={`/team/projects/${p.id}`}>
                    <strong>{p.name}</strong>
                  </Link>
                  <span className="pt-muted pt-small pt-block">
                    {p.client} · {p.status_label}
                  </span>
                </td>
                <td data-label="Worth" className="pt-num">{kes(p.value)}</td>
                <td data-label="Paid" className="pt-num">{kes(p.paid)}</td>
                <td data-label="Hours" className="pt-num">{hm(p.minutes)}</td>
                <td data-label="Time cost" className="pt-num">{kes(p.cost)}</td>
                <td data-label="Profit" className={`pt-num${Number(p.profit) < 0 ? ' tm-bad' : ''}`}>
                  {kes(p.profit)}
                  {p.margin !== null && <span className="pt-muted pt-small pt-block">{p.margin}%</span>}
                </td>
                <td data-label="Budget used">
                  <UsedBar pct={p.budget_used} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">All projects</th>
              <td data-label="Worth" className="pt-num">{kes(t.value)}</td>
              <td data-label="Paid" className="pt-num">{kes(t.paid)}</td>
              <td data-label="Hours" className="pt-num">{hm(t.minutes)}</td>
              <td data-label="Time cost" className="pt-num">{kes(t.cost)}</td>
              <td data-label="Profit" className={`pt-num${Number(t.profit) < 0 ? ' tm-bad' : ''}`}>
                {kes(t.profit)}
                {t.margin !== null && <span className="pt-muted pt-small pt-block">{t.margin}%</span>}
              </td>
              <td data-label="Budget used" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="pt-muted pt-small tm-foot">
        Worth is the project budget, or what’s been invoiced if that’s more. Time cost is hours logged × each person’s hourly cost.
      </p>
    </Panel>
  )
}

export function UsedBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="pt-muted pt-small">No budget</span>
  const tone = pct > 100 ? 'over' : pct > 80 ? 'near' : 'ok'
  return (
    <span className={`tm-used tm-used--${tone}`}>
      <span className="tm-used-bar">
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      {pct}%
    </span>
  )
}

function Rates({ data, onChange }: { data: Profitability; onChange: () => void }) {
  const staff = useApi<Staff[]>('/api/v1/team/staff/')
  const { busy, run } = useMutation()
  if (!staff.data) return null
  return (
    <details className="pt-panel tm-done">
      <summary>Hourly costs</summary>
      <p className="pt-muted pt-small">
        What an hour of each person costs the business (salary and overheads), used for time cost. Anyone without their own rate uses KES{' '}
        {data.default_hourly_cost.toLocaleString('en-KE')}.{!data.can_edit_rates && ' Only an owner can change these.'}
      </p>
      <ul className="tm-rates">
        {staff.data.map((s) => (
          <li key={s.id}>
            <span>{s.full_name}</span>
            {data.can_edit_rates ? (
              <label>
                <span className="sr-only">Hourly cost for {s.full_name}, KES</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  disabled={busy}
                  defaultValue={s.has_own_rate ? Number(s.hourly_cost) : ''}
                  placeholder={String(data.default_hourly_cost)}
                  onBlur={async (e) => {
                    const v = e.currentTarget.value
                    if (v === (s.has_own_rate ? String(Number(s.hourly_cost)) : '')) return
                    if (await run(`/api/v1/team/staff/${s.id}/`, { hourly_cost: v }, 'PATCH')) {
                      staff.reload()
                      onChange()
                    }
                  }}
                />
              </label>
            ) : (
              <span className="pt-num">{kes(s.hourly_cost)}/h</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
