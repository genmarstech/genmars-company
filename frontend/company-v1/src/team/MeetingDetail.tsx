import { useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, StatusBadge, TeamLayout } from '../portal/PortalLayout'
import { formatDate, timeAgo, useApi } from '../portal/useApi'
import { Field } from './Field'
import {
  CATEGORIES, canJoin, clock, dayLabel, joinMeeting, reportTone, statusTone, timeRange, toLocalInput,
  type ActionItem, type MeetingDetail as Meeting, type Participant, type Point, type PointKind,
} from './meetingTypes'
import { formData, hm, isoDate, useMutation } from './shared'
import type { Staff, TeamProject } from './types'
import './meetings.css'

export function MeetingDetail({ id }: { id: string }) {
  const { data: m, error, reload } = useApi<Meeting>(`/api/v1/meetings/${id}/`)
  const staff = useApi<Staff[]>('/api/v1/team/staff/')
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const { busy, message, run } = useMutation()
  const base = `/api/v1/meetings/${id}`

  if (!m) {
    return (
      <TeamLayout title="Meeting">
        <Link to="/team/meetings" className="pt-back">← All meetings</Link>
        <Loading error={error} />
      </TeamLayout>
    )
  }

  const act = async (path: string, done: string, body: unknown = {}) => {
    setNotice('')
    const res = (await run(`${base}/${path}/`, body)) as (Meeting & { found?: string[] }) | null
    if (res) {
      setNotice(res.found ? (res.found.length ? `Fetched from Google: ${res.found.join(', ')}.` : 'Up to date with Google.') : done)
      reload()
    }
  }
  const cancel = async () => {
    if (await run(`${base}/`, {}, 'DELETE')) {
      setNotice('Meeting cancelled. Invited people were told.')
      reload()
    }
  }
  const people = staff.data ?? []
  const open = m.status === 'planned' || m.status === 'live'

  return (
    <TeamLayout
      title={m.title}
      subtitle={`${dayLabel(m.scheduled_start)} · ${timeRange(m)} · ${m.category_label}`}
      actions={
        <>
          {canJoin(m) && (
            <button type="button" className="btn btn--sm" onClick={async () => setNotice((await joinMeeting(m.id)) ?? '')}>
              <Icon name="video" size={16} /> Join on Meet
            </button>
          )}
          {m.meet_uri && m.status !== 'cancelled' && <CopyLink url={m.meet_uri} />}
        </>
      }
    >
      <div className="mt-topline">
        <Link to="/team/meetings" className="pt-back">← All meetings</Link>
        <span className="tm-badges">
          <StatusBadge tone={statusTone[m.status]}>{m.status === 'planned' && canJoin(m) ? 'Starting soon' : m.status_label}</StatusBadge>
          {m.status !== 'cancelled' && <StatusBadge tone={reportTone[m.report_status]}>Record: {m.report_label.toLowerCase()}</StatusBadge>}
        </span>
        <span className="tm-form-actions tm-push">
          {open && <button type="button" className="tm-link-btn" onClick={() => setEditing((e) => !e)}>{editing ? 'Close' : 'Edit'}</button>}
          {(m.meet_uri || m.meeting_code) && m.status !== 'cancelled' && (
            <button type="button" className="tm-link-btn" disabled={busy} onClick={() => act('sync', '')}>Fetch from Google</button>
          )}
          {open && <button type="button" className="tm-link-btn" disabled={busy} onClick={() => act('complete', 'Marked as finished.')}>Mark finished</button>}
          {open && <ConfirmButton label="Cancel meeting" confirm="Cancel it and tell everyone" busy={busy} onConfirm={cancel} />}
        </span>
      </div>
      {message && <p className="pt-error">{message}</p>}
      {notice && <p className="mt-banner mt-banner--ok" role="status">{notice}</p>}
      {m.google_error && <p className="mt-banner mt-banner--bad">{m.google_error}</p>}
      {m.conference_status === 'pending' && <p className="mt-banner">Google is still creating the Meet link. Use Fetch from Google in a moment.</p>}

      {editing && (
        <Panel title="Edit meeting">
          <EditForm
            m={m}
            onSaved={() => {
              setEditing(false)
              setNotice('Saved. Calendar invites were updated.')
              reload()
            }}
          />
        </Panel>
      )}

      <div className="pt-detail">
        <div className="pt-side-col">
          <Agenda m={m} onChange={reload} />
          <MeetingRecord m={m} onChange={reload} />
          <Points m={m} kind="discussion" title="Discussion" hint="Topics covered and what was said about them." onChange={reload} staff={people} />
          <Problems m={m} onChange={reload} staff={people} />
          <Points m={m} kind="decision" title="Decisions" hint="Proposed until someone approves it." onChange={reload} staff={people} />
          <Actions m={m} onChange={reload} staff={people} />
          <Notes m={m} onChange={reload} />
          <Transcript m={m} />
        </div>
        <div className="pt-side-col">
          <Overview m={m} />
          <People m={m} onChange={reload} staff={people} />
          <Panel title="Activity">
            {m.activity.length === 0 ? (
              <Empty>Nothing yet.</Empty>
            ) : (
              <ul className="mt-activity">
                {m.activity.map((a) => (
                  <li key={a.id}>
                    <span>{a.text}</span>
                    <time className="pt-muted pt-small" dateTime={a.at}>{timeAgo(a.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </TeamLayout>
  )
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn btn--sm btn--ghost"
      onClick={async () => {
        await navigator.clipboard?.writeText(url).catch(() => undefined)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
      }}
    >
      <Icon name="link2" size={16} /> {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}

function ConfirmButton({ label, confirm, busy, onConfirm }: { label: string; confirm: string; busy: boolean; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false)
  return asking ? (
    <span className="mt-confirm">
      <button type="button" className="tm-link-btn tm-danger" disabled={busy} onClick={onConfirm}>{confirm}</button>
      <button type="button" className="tm-link-btn" onClick={() => setAsking(false)}>Keep</button>
    </span>
  ) : (
    <button type="button" className="tm-link-btn tm-danger" onClick={() => setAsking(true)}>{label}</button>
  )
}

function Overview({ m }: { m: Meeting }) {
  const attended = m.participants.filter((p) => p.attended).length
  return (
    <Panel title="Overview">
      <dl className="pt-info">
        <dt>When</dt>
        <dd>
          {formatDate(m.scheduled_start)}
          <span className="pt-muted pt-small pt-block">{timeRange(m)}{m.duration_minutes ? ` · ${hm(m.duration_minutes)}` : ''}</span>
        </dd>
        <dt>Organizer</dt>
        <dd>{m.organizer_name || '—'}</dd>
        <dt>Project</dt>
        <dd>{m.project ? <Link to={`/team/projects/${m.project}`}>{m.project_name}</Link> : '—'}</dd>
        <dt>Type</dt>
        <dd>{m.category_label}{m.kind === 'instant' ? ' · instant' : ''}</dd>
        <dt>Meet</dt>
        <dd>{m.meet_uri ? <a href={m.meet_uri} target="_blank" rel="noreferrer" className="mt-code">{m.meeting_code || 'Open'}</a> : m.conference_label}</dd>
        {m.calendar_link && (
          <>
            <dt>Calendar</dt>
            <dd><a href={m.calendar_link} target="_blank" rel="noreferrer">Open event</a></dd>
          </>
        )}
        {m.status === 'completed' && (
          <>
            <dt>Attended</dt>
            <dd>{attended ? `${attended} of ${m.participants.length}` : 'Not known yet'}</dd>
          </>
        )}
        {m.last_synced_at && (
          <>
            <dt>Google sync</dt>
            <dd className="pt-small">{timeAgo(m.last_synced_at)}{m.sync_done ? '' : ', checking again later'}</dd>
          </>
        )}
      </dl>
      {m.description && <p className="pt-small mt-desc">{m.description}</p>}
    </Panel>
  )
}

function EditForm({ m, onSaved }: { m: Meeting; onSaved: () => void }) {
  const { busy, errors, message, run } = useMutation()
  const projects = useApi<TeamProject[]>('/api/v1/team/projects/')
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = formData(e)
    const body = {
      title: f.title,
      description: f.description ?? '',
      category: f.category,
      project: f.project ? Number(f.project) : null,
      scheduled_start: f.start ? new Date(f.start).toISOString() : undefined,
      scheduled_end: f.end ? new Date(f.end).toISOString() : null,
      send_invites: f.send_invites === 'on',
    }
    if (await run(`/api/v1/meetings/${m.id}/`, body, 'PATCH')) onSaved()
  }
  return (
    <form className="tm-form" onSubmit={submit}>
      {message && <p className="pt-error tm-wide">{message}</p>}
      <Field label="Title" error={errors.title} wide>
        <input name="title" required defaultValue={m.title} />
      </Field>
      <Field label="Starts" error={errors.scheduled_start}>
        <input name="start" type="datetime-local" required defaultValue={toLocalInput(m.scheduled_start)} />
      </Field>
      <Field label="Ends" error={errors.scheduled_end}>
        <input name="end" type="datetime-local" defaultValue={toLocalInput(m.scheduled_end)} />
      </Field>
      <Field label="Type">
        <select name="category" defaultValue={m.category}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="Project" error={errors.project}>
        <select name="project" defaultValue={m.project ?? ''}>
          <option value="">None</option>
          {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.client_name}</option>)}
        </select>
      </Field>
      <Field label="Description" wide>
        <textarea name="description" rows={2} defaultValue={m.description} />
      </Field>
      <div className="tm-form-actions tm-wide">
        <button type="submit" className="btn btn--sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        {m.calendar_link && (
          <label className="tm-checkline">
            <input type="checkbox" name="send_invites" defaultChecked /> Update the Calendar event and tell guests
          </label>
        )}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------- agenda

function Agenda({ m, onChange }: { m: Meeting; onChange: () => void }) {
  const { busy, run } = useMutation()
  const url = `/api/v1/meetings/${m.id}/agenda/`
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = formData(e)
    if (f.title && (await run(url, { title: f.title, minutes: f.minutes ? Number(f.minutes) : null }))) {
      form.reset()
      onChange()
    }
  }
  const planned = m.agenda.reduce((sum, a) => sum + (a.minutes ?? 0), 0)
  return (
    <Panel title="Agenda" action={planned > 0 && <span className="pt-muted pt-small">{hm(planned)} planned</span>}>
      {m.agenda.length === 0 && <Empty>No agenda yet. A short one keeps the meeting on time.</Empty>}
      <ol className="mt-agenda">
        {m.agenda.map((a) => (
          <li key={a.id} className={a.covered ? 'is-done' : ''}>
            <input type="checkbox" className="tm-check" checked={a.covered} disabled={busy} aria-label={`Mark “${a.title}” covered`} onChange={async () => (await run(`${url}${a.id}/`, { covered: !a.covered }, 'PATCH')) && onChange()} />
            <span className="mt-agenda-title">{a.title}</span>
            {a.minutes ? <span className="pt-muted pt-small">{a.minutes} min</span> : null}
            <button type="button" className="mt-x" aria-label={`Remove “${a.title}”`} onClick={async () => (await run(`${url}${a.id}/`, {}, 'DELETE')) && onChange()}>
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ol>
      <form className="mt-inline" onSubmit={add}>
        <input name="title" placeholder="Add an agenda item" aria-label="Agenda item" />
        <input name="minutes" type="number" min={1} max={480} placeholder="min" aria-label="Minutes" className="mt-mins" />
        <button type="submit" className="btn btn--sm btn--ghost" disabled={busy}>Add</button>
      </form>
    </Panel>
  )
}

// ---------------------------------------------------------------- the record

function MeetingRecord({ m, onChange }: { m: Meeting; onChange: () => void }) {
  const { busy, errors, message, run } = useMutation()
  const [draft, setDraft] = useState(m.summary)
  const dirty = draft.trim() !== m.summary.trim()
  const save = async () => (await run(`/api/v1/meetings/${m.id}/`, { summary: draft.trim() }, 'PATCH')) && onChange()
  const step = async (s: string) => {
    if (dirty && !(await run(`/api/v1/meetings/${m.id}/`, { summary: draft.trim() }, 'PATCH'))) return
    if (await run(`/api/v1/meetings/${m.id}/report/`, { step: s })) onChange()
  }
  const decisions = m.points.filter((p) => p.kind === 'decision' && p.status === 'approved').length
  const problems = m.points.filter((p) => p.kind === 'problem').length

  return (
    <Panel title="Meeting record" action={<StatusBadge tone={reportTone[m.report_status]}>{m.report_label}</StatusBadge>}>
      {message && <p className="pt-error">{message}</p>}
      <label className="field" data-invalid={!!errors.summary}>
        <span>Summary</span>
        <textarea className="mt-summary" rows={4} value={draft} placeholder="In a few lines: why we met, what we agreed, what happens next." onChange={(e) => setDraft(e.target.value)} />
        {errors.summary && <span className="field-error">{errors.summary}</span>}
      </label>
      <p className="pt-muted pt-small mt-gap">
        {decisions} approved decision{decisions === 1 ? '' : 's'} · {problems} problem{problems === 1 ? '' : 's'} · {m.actions.length} action item{m.actions.length === 1 ? '' : 's'}
        {m.report_status === 'approved' && m.report_approved_by_name && ` · approved by ${m.report_approved_by_name} ${formatDate(m.report_approved_at, false)}`}
      </p>
      <div className="tm-form-actions mt-gap">
        {dirty && <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={save}>Save summary</button>}
        {m.report_status === 'draft' && <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => step('submit')}>Send for review</button>}
        {m.report_status !== 'approved' && m.can_approve && <button type="button" className="btn btn--sm" disabled={busy} onClick={() => step('approve')}>Approve record</button>}
        {m.report_status !== 'approved' && !m.can_approve && <span className="pt-muted pt-small">The organizer or an owner approves the record.</span>}
        {m.report_status === 'approved' && <button type="button" className="tm-link-btn" disabled={busy} onClick={() => step('reopen')}>Reopen</button>}
      </div>
    </Panel>
  )
}

const KIND_PLACEHOLDER: Record<PointKind, string> = {
  discussion: 'Topic, e.g. Payment options for the shop',
  problem: 'What’s wrong or in the way',
  solution: 'A way to fix it',
  decision: 'What was decided',
}

function PointForm({ m, kind, problem, onSaved, staff, compact }: { m: Meeting; kind: PointKind; problem?: number; onSaved: () => void; staff: Staff[]; compact?: boolean }) {
  const { busy, errors, message, run } = useMutation()
  const [open, setOpen] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = formData(e)
    const body = { kind, title: f.title, detail: f.detail ?? '', owner: f.owner ? Number(f.owner) : null, problem: problem ?? null }
    if (await run(`/api/v1/meetings/${m.id}/points/`, body)) {
      setOpen(false)
      onSaved()
    }
  }
  if (!open) {
    return (
      <button type="button" className="tm-link-btn mt-add" onClick={() => setOpen(true)}>
        + {kind === 'solution' ? 'Propose a solution' : `Add ${kind === 'discussion' ? 'a topic' : `a ${kind}`}`}
      </button>
    )
  }
  return (
    <form className={`tm-form tm-form--compact${compact ? ' mt-nested' : ''}`} onSubmit={submit}>
      {message && <p className="pt-error tm-wide">{message}</p>}
      <Field label={kind === 'discussion' ? 'Topic' : kind === 'decision' ? 'Decision' : kind === 'problem' ? 'Problem' : 'Solution'} error={errors.title} wide>
        <input name="title" required placeholder={KIND_PLACEHOLDER[kind]} autoFocus />
      </Field>
      <Field label={kind === 'problem' ? 'Impact' : kind === 'solution' ? 'Expected outcome' : kind === 'decision' ? 'Context' : 'Notes'} wide>
        <textarea name="detail" rows={2} />
      </Field>
      {kind !== 'discussion' && (
        <Field label="Owner" error={errors.owner}>
          <select name="owner" defaultValue="">
            <option value="">Nobody yet</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </Field>
      )}
      <div className="tm-form-actions tm-wide">
        <button type="submit" className="btn btn--sm" disabled={busy}>Add</button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  )
}

function PointRow({ p, m, onChange, children }: { p: Point; m: Meeting; onChange: () => void; children?: ReactNode }) {
  const { busy, run } = useMutation()
  const url = `/api/v1/meetings/${m.id}/points/${p.id}/`
  const tone = p.status === 'approved' || p.status === 'accepted' || p.status === 'resolved' ? 'green' : p.status === 'rejected' ? 'red' : p.status === 'open' ? 'amber' : p.status === 'proposed' ? 'blue' : 'gray'
  return (
    <li className="mt-point">
      <div className="mt-point-head">
        <strong>{p.title}</strong>
        {p.kind !== 'discussion' && <StatusBadge tone={tone}>{p.status_label}</StatusBadge>}
      </div>
      {p.detail && <p className="pt-small mt-point-detail">{p.detail}</p>}
      <div className="tm-form-actions pt-small">
        {p.owner_name && <span className="pt-muted">Owner: {p.owner_name}</span>}
        {p.approved_by_name && <span className="pt-muted">{p.status === 'approved' ? 'Approved' : 'Accepted'} by {p.approved_by_name}</span>}
        {(p.kind === 'decision' || p.kind === 'solution') && p.status === 'proposed' && (
          <>
            <button type="button" className="tm-link-btn" disabled={busy} onClick={async () => (await run(`${url}approve/`, {})) && onChange()}>{p.kind === 'decision' ? 'Approve' : 'Accept'}</button>
            <button type="button" className="tm-link-btn" disabled={busy} onClick={async () => (await run(url, { status: 'rejected' }, 'PATCH')) && onChange()}>Reject</button>
          </>
        )}
        {p.kind === 'problem' && (
          <button type="button" className="tm-link-btn" disabled={busy} onClick={async () => (await run(url, { status: p.status === 'open' ? 'resolved' : 'open' }, 'PATCH')) && onChange()}>
            {p.status === 'open' ? 'Mark resolved' : 'Reopen'}
          </button>
        )}
        <button type="button" className="tm-link-btn tm-danger tm-push" disabled={busy} onClick={async () => (await run(url, {}, 'DELETE')) && onChange()}>Remove</button>
      </div>
      {children}
    </li>
  )
}

function Points({ m, kind, title, hint, onChange, staff }: { m: Meeting; kind: PointKind; title: string; hint: string; onChange: () => void; staff: Staff[] }) {
  const list = m.points.filter((p) => p.kind === kind)
  return (
    <Panel title={title}>
      {list.length === 0 ? <Empty>{hint}</Empty> : (
        <ul className="mt-points">
          {list.map((p) => <PointRow key={p.id} p={p} m={m} onChange={onChange} />)}
        </ul>
      )}
      <PointForm m={m} kind={kind} onSaved={onChange} staff={staff} />
    </Panel>
  )
}

function Problems({ m, onChange, staff }: { m: Meeting; onChange: () => void; staff: Staff[] }) {
  const problems = m.points.filter((p) => p.kind === 'problem')
  const open = problems.filter((p) => p.status === 'open').length
  return (
    <Panel title="Problems & proposed solutions" action={problems.length > 0 && <span className="pt-muted pt-small">{open} open</span>}>
      {problems.length === 0 ? <Empty>Blockers, risks and issues raised, each with the fixes people suggested.</Empty> : (
        <ul className="mt-points">
          {problems.map((p) => {
            const solutions = m.points.filter((s) => s.kind === 'solution' && s.problem === p.id)
            return (
              <PointRow key={p.id} p={p} m={m} onChange={onChange}>
                {solutions.length > 0 && (
                  <ul className="mt-points mt-solutions">
                    {solutions.map((s) => <PointRow key={s.id} p={s} m={m} onChange={onChange} />)}
                  </ul>
                )}
                <PointForm m={m} kind="solution" problem={p.id} onSaved={onChange} staff={staff} compact />
              </PointRow>
            )
          })}
        </ul>
      )}
      <PointForm m={m} kind="problem" onSaved={onChange} staff={staff} />
    </Panel>
  )
}

// ---------------------------------------------------------------- action items

function Actions({ m, onChange, staff }: { m: Meeting; onChange: () => void; staff: Staff[] }) {
  const { busy, errors, message, run } = useMutation()
  const [adding, setAdding] = useState(false)
  const url = `/api/v1/meetings/${m.id}/actions/`
  const decisions = m.points.filter((p) => p.kind === 'decision' && p.status !== 'rejected')
  const today = isoDate()

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = formData(e)
    const body = { title: f.title, assignee: f.assignee ? Number(f.assignee) : null, due_date: f.due_date, priority: f.priority, decision: f.decision ? Number(f.decision) : null }
    const item = (await run(url, body)) as ActionItem | null
    if (item && f.make_task === 'on') await run(`${url}${item.id}/task/`, {})
    if (item) {
      setAdding(false)
      onChange()
    }
  }

  return (
    <Panel
      title="Action items"
      action={<button type="button" className="tm-link-btn" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : 'Add action item'}</button>}
    >
      {message && <p className="pt-error">{message}</p>}
      {adding && (
        <form className="tm-form tm-form--compact" onSubmit={add}>
          <Field label="What needs doing" error={errors.title} wide>
            <input name="title" required placeholder="Send the revised quote" autoFocus />
          </Field>
          <Field label="Who" error={errors.assignee}>
            <select name="assignee" defaultValue="">
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
          <Field label="Due">
            <input name="due_date" type="date" />
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue="normal">
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </Field>
          {decisions.length > 0 && (
            <Field label="From decision" error={errors.decision}>
              <select name="decision" defaultValue="">
                <option value="">None</option>
                {decisions.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </Field>
          )}
          <div className="tm-form-actions tm-wide">
            <button type="submit" className="btn btn--sm" disabled={busy}>Add</button>
            <label className="tm-checkline">
              <input type="checkbox" name="make_task" defaultChecked /> Also put it on the team’s task list
            </label>
          </div>
        </form>
      )}
      {m.actions.length === 0 ? (
        !adding && <Empty>Follow-ups, who owns them and when they’re due.</Empty>
      ) : (
        <ul className="tm-tasks">
          {m.actions.map((a) => (
            <li key={a.id} className={`tm-task-row${a.status === 'done' ? ' is-done' : ''}`}>
              <input type="checkbox" className="tm-check" checked={a.status === 'done'} disabled={busy} aria-label={`Mark “${a.title}” ${a.status === 'done' ? 'not done' : 'done'}`} onChange={async () => (await run(`${url}${a.id}/`, { status: a.status === 'done' ? 'todo' : 'done' }, 'PATCH')) && onChange()} />
              <span className="tm-task-main">
                <strong>
                  {a.priority === 'high' && <span className="tm-flag" title="High priority" />}
                  {a.title}
                </strong>
                <span className="pt-muted pt-small">
                  {[a.assignee_name || 'Unassigned', a.status === 'doing' && 'In progress', a.decision && `From: ${m.points.find((p) => p.id === a.decision)?.title ?? 'a decision'}`].filter(Boolean).join(' · ')}
                </span>
              </span>
              {a.task ? (
                <Link to="/team/work" className="tm-link-btn tm-hide-sm">On task list</Link>
              ) : (
                <button type="button" className="tm-link-btn tm-hide-sm" disabled={busy} onClick={async () => (await run(`${url}${a.id}/task/`, {})) && onChange()}>Make task</button>
              )}
              <span className={`tm-due${a.status !== 'done' && a.due_date && a.due_date < today ? ' tm-bad' : ''}`}>{a.due_date ? (a.due_date === today ? 'Today' : formatDate(a.due_date, false)) : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------- notes and transcript

function Notes({ m, onChange }: { m: Meeting; onChange: () => void }) {
  const { busy, message, run } = useMutation()
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = formData(e)
    if (f.body && (await run(`/api/v1/meetings/${m.id}/notes/`, { body: f.body }))) {
      form.reset()
      onChange()
    }
  }
  return (
    <Panel title="Notes">
      {message && <p className="pt-error">{message}</p>}
      {m.notes.length > 0 && (
        <ul className="mt-notes">
          {m.notes.map((n) => (
            <li key={n.id}>
              <p>{n.body}</p>
              <span className="pt-muted pt-small">{n.author_name || 'Someone'} · {clock(n.created_at)}, {formatDate(n.created_at, false)}</span>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-note-form" onSubmit={add}>
        <textarea name="body" rows={2} placeholder="Jot something down. Everyone on the team can see it." aria-label="New note" />
        <button type="submit" className="btn btn--sm btn--ghost" disabled={busy}>Add note</button>
      </form>
    </Panel>
  )
}

function Transcript({ m }: { m: Meeting }) {
  const transcripts = m.artifacts.filter((a) => a.kind === 'transcript')
  const recordings = m.artifacts.filter((a) => a.kind === 'recording' && a.link)
  if (!transcripts.length && !recordings.length) {
    return (
      <Panel title="Transcript & recordings">
        <Empty>
          {m.status === 'completed'
            ? 'Nothing from Google yet. Transcripts appear here if transcription was turned on in the call; it can take up to an hour.'
            : 'If someone turns on transcription in Meet, the transcript is copied here after the call.'}
        </Empty>
      </Panel>
    )
  }
  return (
    <Panel title="Transcript & recordings">
      {recordings.map((r) => (
        <p key={r.id} className="pt-small"><a href={r.link} target="_blank" rel="noreferrer">Recording in Google Drive</a></p>
      ))}
      {transcripts.map((t) => (
        <details key={t.id} className="mt-transcript">
          <summary>
            Transcript{t.content ? ` · ${t.content.split('\n').length} lines` : ' · still being prepared by Google'}
            {t.link && <a href={t.link} target="_blank" rel="noreferrer" className="pt-small" onClick={(e) => e.stopPropagation()}>Open in Google Docs</a>}
          </summary>
          {t.content && <pre>{t.content}</pre>}
        </details>
      ))}
    </Panel>
  )
}

// ---------------------------------------------------------------- people

function People({ m, onChange, staff }: { m: Meeting; onChange: () => void; staff: Staff[] }) {
  const { busy, errors, message, run } = useMutation()
  const [adding, setAdding] = useState(false)
  const url = `/api/v1/meetings/${m.id}/participants/`
  const invited = new Set(m.participants.map((p) => p.email.toLowerCase()))
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = formData(e)
    const body = f.user ? { user: Number(f.user) } : { email: f.email, name: f.name ?? '' }
    if (await run(url, body)) {
      setAdding(false)
      onChange()
    }
  }
  const remove = async (p: Participant) => (await run(`${url}${p.id}/`, {}, 'DELETE')) && onChange()

  return (
    <Panel title={`People · ${m.participants.length}`} action={m.status !== 'cancelled' && <button type="button" className="tm-link-btn" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : 'Invite'}</button>}>
      {message && <p className="pt-error">{message}</p>}
      {adding && (
        <form className="tm-form tm-form--stack mt-gap-b" onSubmit={add}>
          <Field label="Team member" error={errors.user}>
            <select name="user" defaultValue="">
              <option value="">Someone outside the team…</option>
              {staff.filter((s) => !invited.has(s.email.toLowerCase())).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
          <Field label="Or guest email" error={errors.email}>
            <input name="email" type="email" placeholder="client@company.com" />
          </Field>
          <Field label="Guest name">
            <input name="name" placeholder="Optional" />
          </Field>
          <button type="submit" className="btn btn--sm" disabled={busy}>Invite</button>
          {m.calendar_link && <span className="pt-muted pt-small">They get a Calendar invite with the Meet link.</span>}
        </form>
      )}
      <ul className="mt-people-list">
        {m.participants.map((p) => (
          <li key={p.id}>
            <span className="pt-avatar mt-avatar" aria-hidden="true">{(p.name || p.email).slice(0, 1).toUpperCase()}</span>
            <span className="mt-person">
              <strong>{p.name || p.email}</strong>
              <span className="pt-muted pt-small">
                {[p.role !== 'attendee' ? p.role_label : '', p.name ? p.email : '', m.status === 'completed' ? (p.attended ? 'attended' : '') : p.role !== 'organizer' ? p.response_label.toLowerCase() : ''].filter(Boolean).join(' · ')}
              </span>
            </span>
            {p.role !== 'organizer' && m.status !== 'cancelled' && (
              <button type="button" className="mt-x" aria-label={`Remove ${p.name || p.email}`} disabled={busy} onClick={() => remove(p)}>
                <Icon name="close" size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {m.participants.some((p) => p.is_guest) && <p className="pt-muted pt-small mt-gap">Guests join through Meet only. They never see this record.</p>}
    </Panel>
  )
}
