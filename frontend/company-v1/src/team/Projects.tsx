import { useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { services } from '../data/site'
import { Empty, Loading, Panel, StatusBadge, TeamLayout } from '../portal/PortalLayout'
import { ProgressBar } from '../portal/Projects'
import { formatDate, kes, useApi } from '../portal/useApi'
import { navigate } from '../router'
import { Field } from './Field'
import { formData, useMutation } from './shared'
import { TaskPanel } from './Tasks'
import { EntryList, LogTime, UsedBar } from './Time'
import { hm, useOnTimeLogged } from './shared'
import type { Profitability, TeamClient, TeamMilestone, TeamProject, TimeEntry } from './types'

const PROJECT_STATUSES = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'in_review', label: 'In review' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On hold' },
]
const HEALTH = [
  { value: 'on_track', label: 'On track', tone: 'green' },
  { value: 'at_risk', label: 'At risk', tone: 'amber' },
  { value: 'off_track', label: 'Off track', tone: 'red' },
]

type View = 'client' | 'internal'

export function TeamProjects() {
  const params = new URLSearchParams(window.location.search)
  const client = params.get('client') ?? ''
  const [view, setView] = useState<View>(params.get('kind') === 'internal' ? 'internal' : 'client')
  const [creating, setCreating] = useState<View | null>(params.get('new') === '1' ? 'client' : params.get('new') === 'internal' ? 'internal' : null)
  const query = client ? `?client=${client}` : `?kind=${view}`
  const { data, error } = useApi<TeamProject[]>(`/api/v1/team/projects/${query}`)

  const show = (v: View) => {
    setView(v)
    const url = new URL(window.location.href)
    if (v === 'internal') url.searchParams.set('kind', 'internal')
    else url.searchParams.delete('kind')
    window.history.replaceState(null, '', url)
  }
  const open = (kind: View) => {
    setCreating((c) => (c === kind ? null : kind))
    if (!client) show(kind)
  }

  return (
    <TeamLayout
      title="Projects"
      subtitle={client && data?.[0] ? `Projects for ${data[0].client_name}` : 'Client work, and the products we build for ourselves.'}
      actions={
        <>
          <button type="button" className="btn btn--sm" aria-pressed={creating === 'client'} onClick={() => open('client')}>
            {creating === 'client' ? 'Close' : 'New project'}
          </button>
          {!client && (
            <button type="button" className="btn btn--sm btn--ghost" aria-pressed={creating === 'internal'} onClick={() => open('internal')}>
              {creating === 'internal' ? 'Close' : 'Internal project'}
            </button>
          )}
        </>
      }
    >
      {creating === 'client' && <NewProject defaultClient={client} onCreated={(id) => navigate(`/team/projects/${id}`)} />}
      {creating === 'internal' && <NewInternalProject onCreated={(id) => navigate(`/team/projects/${id}`)} />}
      {!client && (
        <div className="tm-seg tm-proj-tabs" role="group" aria-label="Show">
          <button type="button" aria-pressed={view === 'client'} onClick={() => show('client')}>
            Client projects
          </button>
          <button type="button" aria-pressed={view === 'internal'} onClick={() => show('internal')}>
            Internal
          </button>
        </div>
      )}
      <Panel>
        {!data ? (
          <Loading error={error} />
        ) : data.length === 0 ? (
          <Empty>
            {view === 'internal' && !client
              ? 'No internal projects yet. Start one for a product of our own: it stays in testing until you put it live.'
              : 'No projects yet. Create one for a client to show it in their portal.'}
          </Empty>
        ) : view === 'internal' && !client ? (
          <InternalTable rows={data} />
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table pt-stack">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Client</th>
                  <th scope="col">Status</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Due</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="tm-click" onClick={() => navigate(`/team/projects/${p.id}`)}>
                    <td data-label="Project">
                      <Link to={`/team/projects/${p.id}`}>
                        <strong>{p.name}</strong>
                      </Link>
                    </td>
                    <td data-label="Client">{p.client_name}</td>
                    <td data-label="Status">
                      <span className="tm-badges">
                        <StatusBadge tone={p.status === 'completed' ? 'green' : 'blue'}>{p.status_label}</StatusBadge>
                        {p.status !== 'completed' && p.health !== 'on_track' && (
                          <StatusBadge tone={HEALTH.find((h) => h.value === p.health)?.tone ?? 'gray'}>{p.health_label}</StatusBadge>
                        )}
                      </span>
                    </td>
                    <td data-label="Progress" className="tm-progress-cell">
                      <ProgressBar value={p.progress} /> {p.progress}%
                    </td>
                    <td data-label="Due">{formatDate(p.due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </TeamLayout>
  )
}

export function StageBadge({ stage }: { stage: TeamProject['stage'] }) {
  return stage === 'production' ? <StatusBadge tone="green">Production</StatusBadge> : <StatusBadge tone="amber">Testing</StatusBadge>
}

function InternalTable({ rows }: { rows: TeamProject[] }) {
  return (
    <div className="pt-table-wrap">
      <table className="pt-table pt-stack">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Stage</th>
            <th scope="col">Progress</th>
            <th scope="col">Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="tm-click" onClick={() => navigate(`/team/projects/${p.id}`)}>
              <td data-label="Product">
                <Link to={`/team/projects/${p.id}`}>
                  <strong>{p.name}</strong>
                </Link>
                {p.summary && <span className="pt-muted pt-small pt-block">{p.summary}</span>}
              </td>
              <td data-label="Stage">
                <StageBadge stage={p.stage} />
              </td>
              <td data-label="Progress" className="tm-progress-cell">
                <ProgressBar value={p.progress} /> {p.progress}%
              </td>
              <td data-label="Link">
                {p.app_url ? (
                  <a href={p.app_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    {p.app_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                ) : (
                  <span className="pt-muted">Not set</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NewInternalProject({ onCreated }: { onCreated: (id: number) => void }) {
  const { busy, errors, message, run } = useMutation()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const filled = Object.fromEntries(Object.entries(formData(e)).filter(([, v]) => v !== null))
    const created = (await run('/api/v1/team/projects/', { ...filled, kind: 'internal' })) as { id: number } | null
    if (created) onCreated(created.id)
  }

  return (
    <Panel title="New internal project">
      <p className="pt-muted pt-small tm-note">
        For our own products. It starts in testing, where only the team can see it. When it’s ready, move it to production and it
        shows on the Products page and in every client’s portal.
      </p>
      <form className="tm-form" onSubmit={submit}>
        {message && <p className="pt-error tm-wide">{message}</p>}
        <Field label="Product name" error={errors.name}>
          <input name="name" required placeholder="Velora" />
        </Field>
        <Field label="Service">
          <select name="service" defaultValue="">
            <option value="">—</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What it does, in one line" wide>
          <input name="summary" placeholder="Bookings, staff and payments for salons" />
        </Field>
        <Field label="Testing link (optional)" error={errors.app_url} wide>
          <input name="app_url" type="url" placeholder="https://velora.genmars.co.ke" />
        </Field>
        <Field label="Start date">
          <input name="start_date" type="date" />
        </Field>
        <Field label="Target launch">
          <input name="due_date" type="date" />
        </Field>
        <button type="submit" className="btn btn--sm" disabled={busy}>
          {busy ? 'Creating…' : 'Start in testing'}
        </button>
      </form>
    </Panel>
  )
}

function NewProject({ defaultClient, onCreated }: { defaultClient: string; onCreated: (id: number) => void }) {
  const clients = useApi<TeamClient[]>('/api/v1/team/clients/')
  const { busy, errors, message, run } = useMutation()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const body = formData(e)
    const created = (await run('/api/v1/team/projects/', { ...body, client: Number(body.client) })) as { id: number } | null
    if (created) onCreated(created.id)
  }

  return (
    <Panel title="New project">
      <form className="tm-form" onSubmit={submit}>
        {message && <p className="pt-error tm-wide">{message}</p>}
        <Field label="Client" error={errors.client}>
          <select name="client" defaultValue={defaultClient} required>
            <option value="">Choose a client</option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.company_name ? ` · ${c.company_name}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project name" error={errors.name}>
          <input name="name" required placeholder="Website redesign" />
        </Field>
        <Field label="Service">
          <select name="service" defaultValue="">
            <option value="">—</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Budget (KES)" error={errors.budget}>
          <input name="budget" type="number" min="0" step="1000" />
        </Field>
        <Field label="Start date">
          <input name="start_date" type="date" />
        </Field>
        <Field label="Due date">
          <input name="due_date" type="date" />
        </Field>
        <Field label="Summary the client sees" wide>
          <input name="summary" placeholder="Modern website for your business" />
        </Field>
        <button type="submit" className="btn btn--sm" disabled={busy}>
          {busy ? 'Creating…' : 'Create project'}
        </button>
      </form>
    </Panel>
  )
}

export function TeamProjectDetail({ id }: { id: string }) {
  const { data, error, reload } = useApi<TeamProject>(`/api/v1/team/projects/${id}/`)
  const save = useMutation()
  const [saved, setSaved] = useState(false)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaved(false)
    const body = formData(e)
    // text fields clear to '' rather than null
    for (const k of ['summary', 'app_url']) if (k in body && body[k] === null) body[k] = ''
    if (await save.run(`/api/v1/team/projects/${id}/`, { ...body, progress: Number(body.progress ?? 0) }, 'PATCH')) {
      setSaved(true)
      reload()
    }
  }

  const internal = data?.kind === 'internal'

  return (
    <TeamLayout
      title={data?.name ?? 'Project'}
      subtitle={data ? (internal ? `Internal product · ${data.stage_label}` : `${data.client_name} · ${kes(data.budget)}`) : undefined}
      actions={
        data &&
        (internal ? (
          data.stage === 'production' && data.app_url ? (
            <a href={data.app_url} target="_blank" rel="noopener noreferrer" className="btn btn--sm btn--ghost">
              Open product
            </a>
          ) : null
        ) : (
          <Link to={`/team/messages?client=${data.client}`} className="btn btn--sm btn--ghost">
            Message client
          </Link>
        ))
      }
    >
      <Link to={internal ? '/team/projects?kind=internal' : '/team/projects'} className="pt-back">
        ← All projects
      </Link>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="pt-detail">
          <div className="pt-side-col">
            {internal && <Release project={data} onChange={reload} />}
            <Panel title="Milestones">
              <Milestones project={data} onChange={reload} />
            </Panel>
            <TaskPanel project={data} />
            <ProjectTime project={data} />
            <Panel title="Files & links">
              <Links project={data} onChange={reload} />
            </Panel>
          </div>
          <Panel title="Project details">
            <form key={data.updated_at} className="tm-form tm-form--stack" onSubmit={submit}>
              {save.message && <p className="pt-error">{save.message}</p>}
              {saved && (
                <p className="au-msg au-msg--ok">
                  {internal ? 'Saved.' : 'Saved. The client sees the update straight away.'}
                </p>
              )}
              <Field label="Name" error={save.errors.name}>
                <input name="name" defaultValue={data.name} required />
              </Field>
              <Field label={internal ? 'What it does, in one line' : 'Summary'}>
                <input name="summary" defaultValue={data.summary} />
              </Field>
              {internal && (
                <Field label="Product link" error={save.errors.app_url}>
                  <input name="app_url" type="url" defaultValue={data.app_url} placeholder="https://…" />
                </Field>
              )}
              <Field label="Status">
                <select name="status" defaultValue={data.status}>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Health">
                <select name="health" defaultValue={data.health}>
                  {HEALTH.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Progress (%)" error={save.errors.progress}>
                <input name="progress" type="number" min="0" max="100" defaultValue={data.progress} />
              </Field>
              <Field label={internal ? 'Budget we set aside (KES)' : 'Budget (KES)'} error={save.errors.budget}>
                <input name="budget" type="number" min="0" step="1000" defaultValue={data.budget ? Number(data.budget) : ''} />
              </Field>
              <Field label="Start date">
                <input name="start_date" type="date" defaultValue={data.start_date ?? ''} />
              </Field>
              <Field label="Due date">
                <input name="due_date" type="date" defaultValue={data.due_date ?? ''} />
              </Field>
              <button type="submit" className="btn btn--sm" disabled={save.busy}>
                {save.busy ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </Panel>
        </div>
      )}
    </TeamLayout>
  )
}

/** Testing → Production for one of our own products. */
function Release({ project, onChange }: { project: TeamProject; onChange: () => void }) {
  const { busy, errors, message, run } = useMutation()
  const [confirming, setConfirming] = useState(false)
  const live = project.stage === 'production'

  const goLive = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (await run(`/api/v1/team/projects/${project.id}/go-live/`, formData(e))) {
      setConfirming(false)
      onChange()
    }
  }
  const backToTesting = async () => {
    if (await run(`/api/v1/team/projects/${project.id}/back-to-testing/`, {})) onChange()
  }

  return (
    <Panel title="Release" action={<StageBadge stage={project.stage} />}>
      <ol className="tm-stages" aria-label="Stage">
        <li className={live ? 'is-done' : 'is-current'} aria-current={!live ? 'step' : undefined}>
          <strong>Testing</strong>
          <span>Team only</span>
        </li>
        <li className={live ? 'is-current' : ''} aria-current={live ? 'step' : undefined}>
          <strong>Production</strong>
          <span>{live && project.went_live_at ? `Live since ${formatDate(project.went_live_at)}` : 'Open to everyone'}</span>
        </li>
      </ol>
      {message && !errors.app_url && <p className="pt-error">{message}</p>}
      {live ? (
        <div className="tm-release-foot">
          <p className="pt-muted pt-small">
            Listed on the Products page and in every client’s portal
            {project.app_url && (
              <>
                {' '}
                as{' '}
                <a href={project.app_url} target="_blank" rel="noopener noreferrer">
                  {project.app_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </>
            )}
            .
          </p>
          <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={backToTesting}>
            {busy ? 'Moving…' : 'Back to testing'}
          </button>
        </div>
      ) : confirming ? (
        <form className="tm-release-form" onSubmit={goLive}>
          <Field label="Link people will open" error={errors.app_url}>
            <input name="app_url" type="url" required defaultValue={project.app_url} placeholder="https://velora.genmars.co.ke" />
          </Field>
          <p className="pt-muted pt-small">Once it’s live, clients see it in their portal and anyone can find it on the Products page.</p>
          <div className="tm-release-actions">
            <button type="submit" className="btn btn--sm" disabled={busy}>
              {busy ? 'Going live…' : 'Go live'}
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirming(false)}>
              Not yet
            </button>
          </div>
        </form>
      ) : (
        <div className="tm-release-foot">
          <p className="pt-muted pt-small">Ready for real people? Move it to production.</p>
          <button type="button" className="btn btn--sm" onClick={() => setConfirming(true)}>
            Move to production
          </button>
        </div>
      )}
    </Panel>
  )
}

const MS_STATUS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

function Milestones({ project, onChange }: { project: TeamProject; onChange: () => void }) {
  const { busy, message, run } = useMutation()

  const update = async (m: TeamMilestone, fields: Partial<TeamMilestone>) => {
    if (await run(`/api/v1/team/milestones/${m.id}/`, fields, 'PATCH')) onChange()
  }
  const remove = async (m: TeamMilestone) => {
    if (await run(`/api/v1/team/milestones/${m.id}/`, {}, 'DELETE')) onChange()
  }
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const body = formData(e)
    if (await run('/api/v1/team/milestones/', { ...body, project: project.id, order: project.milestones.length + 1 })) {
      form.reset()
      onChange()
    }
  }

  return (
    <>
      {message && <p className="pt-error">{message}</p>}
      {project.milestones.length === 0 ? (
        <Empty>No milestones yet. Add the first one below.</Empty>
      ) : (
        <ol className="tm-milestones">
          {project.milestones.map((m) => (
            <li key={m.id} className={`tm-ms tm-ms--${m.status}`}>
              <div>
                <strong>{m.title}</strong>
                <span className="pt-muted pt-small">
                  {m.status === 'done' ? (m.completed_at ? `Completed ${formatDate(m.completed_at)}` : 'Completed') : m.due_date ? `Due ${formatDate(m.due_date)}` : 'No due date'}
                </span>
              </div>
              <select aria-label={`Status of ${m.title}`} value={m.status} disabled={busy} onChange={(e) => update(m, { status: e.target.value as TeamMilestone['status'] })}>
                {MS_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button type="button" className="pt-icon-btn" aria-label={`Remove ${m.title}`} disabled={busy} onClick={() => remove(m)}>
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <form className="tm-inline" onSubmit={add}>
        <label className="sr-only" htmlFor="ms-title">
          Milestone
        </label>
        <input id="ms-title" name="title" required placeholder="New milestone, e.g. Design phase" />
        <label className="sr-only" htmlFor="ms-due">
          Due date
        </label>
        <input id="ms-due" name="due_date" type="date" />
        <button type="submit" className="btn btn--sm" disabled={busy}>
          Add
        </button>
      </form>
    </>
  )
}

function Links({ project, onChange }: { project: TeamProject; onChange: () => void }) {
  const { busy, errors, run } = useMutation()
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    if (await run('/api/v1/team/links/', { ...formData(e), project: project.id })) {
      form.reset()
      onChange()
    }
  }
  return (
    <>
      {project.links.length > 0 && (
        <ul className="pt-links">
          {project.links.map((l) => (
            <li key={l.id}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                <Icon name="link2" size={16} /> {l.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      <form className="tm-inline" onSubmit={add}>
        <label className="sr-only" htmlFor="ln-title">
          Title
        </label>
        <input id="ln-title" name="title" required placeholder="Title, e.g. Staging site" />
        <label className="sr-only" htmlFor="ln-url">
          Link
        </label>
        <input id="ln-url" name="url" type="url" required placeholder="https://…" aria-invalid={!!errors.url} />
        <button type="submit" className="btn btn--sm" disabled={busy}>
          Add
        </button>
      </form>
      {errors.url && <span className="field-error">{errors.url}</span>}
    </>
  )
}

function ProjectTime({ project }: { project: TeamProject }) {
  const entries = useApi<TimeEntry[]>(`/api/v1/team/time/?project=${project.id}`)
  const money = useApi<Profitability>('/api/v1/team/profitability/')
  const [logging, setLogging] = useState(false)
  const reload = () => {
    entries.reload()
    money.reload()
  }
  useOnTimeLogged(entries.reload)
  const row = money.data?.projects.find((p) => p.id === project.id)

  return (
    <Panel
      title="Time & money"
      action={
        <button type="button" className="tm-link-btn" onClick={() => setLogging((l) => !l)}>
          {logging ? 'Cancel' : 'Log time'}
        </button>
      }
    >
      {row && (
        <dl className="tm-money-grid">
          <div>
            <dt>Worth</dt>
            <dd>{kes(row.value)}</dd>
          </div>
          <div>
            <dt>Hours</dt>
            <dd>{hm(row.minutes)}</dd>
          </div>
          <div>
            <dt>Time cost</dt>
            <dd>{kes(row.cost)}</dd>
          </div>
          <div>
            <dt>Profit</dt>
            <dd className={Number(row.profit) < 0 ? 'tm-bad' : ''}>{kes(row.profit)}</dd>
          </div>
          <div className="tm-wide">
            <dt>Budget used by time</dt>
            <dd>
              <UsedBar pct={row.budget_used} />
            </dd>
          </div>
        </dl>
      )}
      {logging && (
        <LogTime
          project={project}
          onSaved={() => {
            setLogging(false)
            reload()
          }}
        />
      )}
      {entries.data && entries.data.length > 0 && <EntryList entries={entries.data.slice(0, 8)} onChange={reload} showUser />}
    </Panel>
  )
}
