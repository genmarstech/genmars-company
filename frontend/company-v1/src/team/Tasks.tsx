import { useState, type FormEvent } from 'react'
import { useSession } from '../auth/session'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, TeamLayout } from '../portal/PortalLayout'
import { formatDate, useApi } from '../portal/useApi'
import { Field } from './Field'
import { formData, hm, isoDate, useMutation } from './shared'
import { startTimer } from './timerStore'
import type { Staff, Task, TeamProject } from './types'

const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/** Split open tasks by when they're due. */
function group(tasks: Task[]) {
  const today = isoDate()
  const week = addDays(7)
  const groups: [string, Task[]][] = [
    ['Overdue', []],
    ['Today', []],
    ['Next 7 days', []],
    ['Later', []],
    ['No due date', []],
  ]
  for (const t of tasks) {
    const d = t.due_date
    const i = !d ? 4 : d < today ? 0 : d === today ? 1 : d <= week ? 2 : 3
    groups[i][1].push(t)
  }
  return groups.filter(([, list]) => list.length)
}

export function MyWork() {
  const { user } = useSession()
  const params = new URLSearchParams(window.location.search)
  const [who, setWho] = useState<string>('mine')
  const [adding, setAdding] = useState(params.get('new') === '1')
  const staff = useApi<Staff[]>('/api/v1/team/staff/')
  const filter = who === 'mine' ? 'mine=1' : who === 'all' ? '' : `assignee=${who}`
  const open = useApi<Task[]>(`/api/v1/team/tasks/?open=1${filter ? `&${filter}` : ''}`)
  const done = useApi<Task[]>(`/api/v1/team/tasks/?status=done${filter ? `&${filter}` : ''}`)
  const reload = () => {
    open.reload()
    done.reload()
  }
  const person = staff.data?.find((s) => String(s.id) === who)

  return (
    <TeamLayout
      title={who === 'mine' ? 'My work' : who === 'all' ? 'Everyone’s work' : `${person?.full_name.split(' ')[0] ?? 'Their'}’s work`}
      subtitle="Open tasks, soonest first."
      actions={
        <>
          <label className="pt-filter">
            <span className="sr-only">Whose tasks</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="mine">Mine</option>
              <option value="all">Everyone</option>
              {staff.data
                ?.filter((s) => s.id !== user?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
            </select>
          </label>
          <button type="button" className="btn btn--sm" onClick={() => setAdding((a) => !a)}>
            {adding ? 'Close' : 'New task'}
          </button>
        </>
      }
    >
      {adding && (
        <Panel title="New task">
          <TaskForm
            staff={staff.data ?? []}
            defaults={{ assignee: who === 'mine' || who === 'all' ? user?.id : Number(who) }}
            onSaved={() => {
              setAdding(false)
              reload()
            }}
          />
        </Panel>
      )}
      {!open.data ? (
        <Loading error={open.error} />
      ) : open.data.length === 0 ? (
        <Panel>
          <Empty>No open tasks{who === 'mine' ? ' for you' : ''}. Add one, or give one to a teammate.</Empty>
        </Panel>
      ) : (
        group(open.data).map(([label, list]) => (
          <Panel key={label} title={`${label} · ${list.length}`} className={label === 'Overdue' ? 'tm-panel-overdue' : ''}>
            <TaskList tasks={list} staff={staff.data ?? []} onChange={reload} showAssignee={who !== 'mine'} />
          </Panel>
        ))
      )}
      {done.data && done.data.length > 0 && (
        <details className="pt-panel tm-done">
          <summary>Done · {done.data.length}</summary>
          <TaskList tasks={done.data.slice(0, 25)} staff={staff.data ?? []} onChange={reload} showAssignee={who !== 'mine'} />
        </details>
      )}
    </TeamLayout>
  )
}

/** Tasks for one project or client, shown on its page. */
export function TaskPanel({ project, client }: { project?: TeamProject; client?: number }) {
  const { user } = useSession()
  const staff = useApi<Staff[]>('/api/v1/team/staff/')
  const query = project ? `project=${project.id}` : `client=${client}`
  const { data, error, reload } = useApi<Task[]>(`/api/v1/team/tasks/?${query}`)
  const [adding, setAdding] = useState(false)
  const open = data?.filter((t) => t.status !== 'done') ?? []
  const doneCount = (data?.length ?? 0) - open.length

  return (
    <Panel
      title="Tasks"
      action={
        <button type="button" className="tm-link-btn" onClick={() => setAdding((a) => !a)}>
          {adding ? 'Cancel' : 'Add task'}
        </button>
      }
    >
      {adding && (
        <TaskForm
          compact
          staff={staff.data ?? []}
          defaults={{ assignee: user?.id, project: project?.id, client }}
          onSaved={() => {
            setAdding(false)
            reload()
          }}
        />
      )}
      {!data ? (
        <Loading error={error} />
      ) : open.length === 0 ? (
        !adding && <Empty>No open tasks{doneCount ? ` · ${doneCount} done` : ''}.</Empty>
      ) : (
        <>
          <TaskList tasks={open} staff={staff.data ?? []} onChange={reload} showAssignee showProject={!project} />
          {doneCount > 0 && <p className="pt-muted pt-small tm-foot">{doneCount} done</p>}
        </>
      )}
    </Panel>
  )
}

export function TaskList({ tasks, staff, onChange, showAssignee = false, showProject = true }: {
  tasks: Task[]
  staff: Staff[]
  onChange: () => void
  showAssignee?: boolean
  showProject?: boolean
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const { busy, run } = useMutation()
  const today = isoDate()

  const toggle = async (t: Task) => {
    if (await run(`/api/v1/team/tasks/${t.id}/`, { status: t.status === 'done' ? 'todo' : 'done' }, 'PATCH')) onChange()
  }

  return (
    <ul className="tm-tasks">
      {tasks.map((t) =>
        editing === t.id ? (
          <li key={t.id} className="tm-task-edit">
            <TaskForm
              compact
              task={t}
              staff={staff}
              onSaved={() => {
                setEditing(null)
                onChange()
              }}
              onCancel={() => setEditing(null)}
            />
          </li>
        ) : (
          <li key={t.id} className={`tm-task-row${t.status === 'done' ? ' is-done' : ''}`}>
            <input type="checkbox" className="tm-check" checked={t.status === 'done'} disabled={busy} aria-label={`Mark “${t.title}” ${t.status === 'done' ? 'not done' : 'done'}`} onChange={() => toggle(t)} />
            <button type="button" className="tm-task-main" onClick={() => setEditing(t.id)}>
              <strong>
                {t.priority === 'high' && <span className="tm-flag" title="High priority" />}
                {t.title}
              </strong>
              <span className="pt-muted pt-small">
                {[
                  showProject && (t.project_name || t.client_name),
                  showAssignee && (t.assignee_name || 'Unassigned'),
                  t.status === 'doing' && 'In progress',
                  t.logged_minutes > 0 && `${hm(t.logged_minutes)} logged`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
            {t.status !== 'done' && t.project && (
              <button type="button" className="tm-link-btn tm-hide-sm" title="Start a timer for this task" onClick={() => startTimer({ project: t.project!, task: t.id, label: t.title })}>
                Start timer
              </button>
            )}
            <span className={`tm-due${t.status !== 'done' && t.due_date && t.due_date < today ? ' tm-bad' : ''}`}>
              {t.status === 'done' ? `Done ${formatDate(t.completed_at, false)}` : t.due_date ? (t.due_date === today ? 'Today' : formatDate(t.due_date, false)) : ''}
            </span>
          </li>
        ),
      )}
    </ul>
  )
}

function TaskForm({ task, defaults = {}, staff, onSaved, onCancel, compact = false }: {
  task?: Task
  defaults?: { assignee?: number; project?: number; client?: number }
  staff: Staff[]
  onSaved: () => void
  onCancel?: () => void
  compact?: boolean
}) {
  const { busy, errors, message, run } = useMutation()
  const fixedPlace = !!(defaults.project || defaults.client)
  const projects = useApi<TeamProject[]>(task || fixedPlace ? null : '/api/v1/team/projects/')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const body: Record<string, unknown> = formData(e)
    for (const k of ['assignee', 'project']) if (k in body) body[k] = body[k] ? Number(body[k]) : null
    body.notes = body.notes ?? ''
    if (!task) {
      if (defaults.project) body.project = defaults.project
      if (defaults.client) body.client = defaults.client
    }
    const ok = await run(task ? `/api/v1/team/tasks/${task.id}/` : '/api/v1/team/tasks/', body, task ? 'PATCH' : 'POST')
    if (ok) onSaved()
  }
  const remove = async () => {
    if (task && (await run(`/api/v1/team/tasks/${task.id}/`, {}, 'DELETE'))) onSaved()
  }

  return (
    <form className={`tm-form${compact ? ' tm-form--compact' : ''}`} onSubmit={submit}>
      {message && <p className="pt-error tm-wide">{message}</p>}
      <Field label="Task" error={errors.title} wide>
        <input name="title" required defaultValue={task?.title} placeholder="Send the homepage draft to the client" autoFocus />
      </Field>
      <Field label="Who" error={errors.assignee}>
        <select name="assignee" defaultValue={task ? (task.assignee ?? '') : (defaults.assignee ?? '')}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Due">
        <input name="due_date" type="date" defaultValue={task?.due_date ?? ''} />
      </Field>
      <Field label="Priority">
        <select name="priority" defaultValue={task?.priority ?? 'normal'}>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      {task && (
        <Field label="Status">
          <select name="status" defaultValue={task.status}>
            <option value="todo">To do</option>
            <option value="doing">In progress</option>
            <option value="done">Done</option>
          </select>
        </Field>
      )}
      {projects.data && (
        <Field label="Project" error={errors.project}>
          <select name="project" defaultValue="">
            <option value="">None</option>
            {projects.data
              .filter((p) => p.status !== 'completed')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.client_name}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label="Notes" wide>
        <textarea name="notes" rows={2} defaultValue={task?.notes} placeholder="Anything they need to know" />
      </Field>
      <div className="tm-form-actions tm-wide">
        <button type="submit" className="btn btn--sm" disabled={busy}>
          {busy ? 'Saving…' : task ? 'Save' : 'Add task'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        {task && (
          <>
            {task.project && (
              <Link to={`/team/projects/${task.project}`} className="tm-link-btn">
                Open project
              </Link>
            )}
            <button type="button" className="tm-link-btn tm-danger" disabled={busy} onClick={remove}>
              Delete task
            </button>
          </>
        )}
        {task && <span className="pt-muted pt-small tm-push">Added by {task.created_by_name || 'someone'} · {formatDate(task.created_at, false)}</span>}
      </div>
    </form>
  )
}
