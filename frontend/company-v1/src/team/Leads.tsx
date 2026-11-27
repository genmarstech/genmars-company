import { useState } from 'react'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, StatusBadge, TeamLayout } from '../portal/PortalLayout'
import { formatDate, useApi } from '../portal/useApi'
import { Field } from './Field'
import { formData, useMutation, useScrollToHash } from './shared'
import type { Lead } from './types'

const STATUSES = [
  { value: 'new', label: 'New', tone: 'blue' },
  { value: 'contacted', label: 'Contacted', tone: 'amber' },
  { value: 'proposal_sent', label: 'Proposal sent', tone: 'amber' },
  { value: 'won', label: 'Won', tone: 'green' },
  { value: 'lost', label: 'Lost', tone: 'gray' },
]

const PITCH_STEPS = [
  { value: 'draft', label: 'Draft', hint: 'We’re building the preview.' },
  { value: 'sent', label: 'Sent', hint: 'They have the link. Waiting to hear back.' },
  { value: 'feedback', label: 'Feedback', hint: 'They replied. Note what they asked for.' },
  { value: 'approved', label: 'Approved', hint: 'They want it built. Start the project below.' },
]

const SERVICES = [
  { value: 'website', label: 'Website' },
  { value: 'ecommerce', label: 'E-commerce store' },
  { value: 'ui_ux', label: 'UI/UX design' },
  { value: 'custom_software', label: 'Custom software' },
  { value: 'automation', label: 'Business automation' },
  { value: 'other', label: 'Something else' },
]

/** People paste "acme.co.ke"; the API wants a full address. */
function withScheme(url: string | null) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function Leads() {
  const [status, setStatus] = useState('')
  const [pitches, setPitches] = useState(() => new URLSearchParams(window.location.search).has('pitch'))
  const [adding, setAdding] = useState(false)
  const query = new URLSearchParams({ ...(status ? { status } : {}), ...(pitches ? { pitch: '1' } : {}) }).toString()
  const { data, error, reload } = useApi<Lead[]>(`/api/v1/enquiries/inbox/${query ? `?${query}` : ''}`)
  useScrollToHash(!!data)

  const showPitches = (on: boolean) => {
    setPitches(on)
    const url = new URL(window.location.href)
    if (on) url.searchParams.set('pitch', '1')
    else url.searchParams.delete('pitch')
    window.history.replaceState(null, '', url)
  }

  return (
    <TeamLayout
      title="Leads"
      subtitle="Briefs from the website, and businesses we’re pitching a redesign to."
      actions={
        <>
          <label className="pt-filter">
            <span className="sr-only">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--sm" aria-pressed={adding} onClick={() => setAdding((a) => !a)}>
            {adding ? 'Close' : 'Add a lead'}
          </button>
        </>
      }
    >
      {adding && (
        <AddLead
          onAdded={() => {
            setAdding(false)
            reload()
          }}
        />
      )}
      <div className="tm-seg tm-lead-tabs" role="group" aria-label="Show">
        <button type="button" aria-pressed={!pitches} onClick={() => showPitches(false)}>
          All leads
        </button>
        <button type="button" aria-pressed={pitches} onClick={() => showPitches(true)}>
          Redesign pitches
        </button>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <Panel>
          <Empty>
            {pitches
              ? 'No redesign pitches yet. Add a business whose site you’d like to redo, with a link to their current site.'
              : 'No leads here yet.'}
          </Empty>
        </Panel>
      ) : (
        <div className="tm-leads">
          {data.map((l) => (
            <LeadCard key={l.id} lead={l} onSaved={reload} />
          ))}
        </div>
      )}
    </TeamLayout>
  )
}

function AddLead({ onAdded }: { onAdded: () => void }) {
  const { busy, errors, message, run } = useMutation()

  return (
    <Panel title="Add a lead">
      <form
        className="tm-form tm-form--compact"
        onSubmit={async (e) => {
          e.preventDefault()
          const f = formData(e)
          const ok = await run('/api/v1/enquiries/inbox/', {
            full_name: f.full_name ?? '',
            email: f.email ?? '',
            phone_number: f.phone_number ?? '',
            company_name: f.company_name ?? '',
            service: f.service ?? 'website',
            current_site_url: withScheme(f.current_site_url),
            preview_url: withScheme(f.preview_url),
            message: f.message ?? '',
          })
          if (ok) onAdded()
        }}
      >
        <Field label="Contact name" error={errors.full_name}>
          <input name="full_name" required autoComplete="off" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label="Phone" error={errors.phone_number}>
          <input name="phone_number" inputMode="tel" autoComplete="off" />
        </Field>
        <Field label="Business" error={errors.company_name}>
          <input name="company_name" autoComplete="off" />
        </Field>
        <Field label="Their site today" error={errors.current_site_url}>
          <input name="current_site_url" inputMode="url" placeholder="theirbusiness.com" />
        </Field>
        <Field label="Our preview link (optional)" error={errors.preview_url}>
          <input name="preview_url" inputMode="url" placeholder="their-redesign.vercel.app" />
        </Field>
        <Field label="Service" error={errors.service}>
          <select name="service" defaultValue="website">
            {SERVICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes" error={errors.message} wide>
          <textarea name="message" rows={3} placeholder="Slow site, no mobile layout, menu is a PDF. Met the owner at the expo." />
        </Field>
        <div className="tm-form-actions tm-wide">
          <button type="submit" className="btn btn--sm" disabled={busy}>
            Add lead
          </button>
          <span className="pt-muted pt-small">{message || 'Add their current site and it starts as a redesign pitch.'}</span>
        </div>
      </form>
    </Panel>
  )
}

function LeadCard({ lead, onSaved }: { lead: Lead; onSaved: () => void }) {
  const { busy, message, errors, run } = useMutation()
  const [notes, setNotes] = useState(lead.internal_notes)
  const [pitching, setPitching] = useState(false)
  const s = STATUSES.find((x) => x.value === lead.status)
  const hasPitch = !!lead.pitch_status || pitching

  const save = async (fields: Partial<Lead>) => {
    if (await run(`/api/v1/enquiries/inbox/${lead.id}/`, fields, 'PATCH')) onSaved()
  }

  return (
    <article className="pt-panel tm-lead" id={`lead-${lead.id}`}>
      <div className="tm-lead-top">
        <div>
          <h2>{lead.company_name ? `${lead.company_name}` : lead.full_name}</h2>
          <span className="pt-muted pt-small">
            {lead.company_name && `${lead.full_name} · `}
            <a href={`mailto:${lead.email}`}>{lead.email}</a>
            {lead.phone_number && ` · ${lead.phone_number}`} · {formatDate(lead.created_at)}
          </span>
        </div>
        <StatusBadge tone={s?.tone ?? 'gray'}>{s?.label ?? lead.status}</StatusBadge>
      </div>
      <p className="tm-lead-meta">
        <strong>{lead.service_label}</strong>
        {lead.source !== 'team' && ` · ${lead.budget_label}`} · {lead.source_label}
      </p>
      {lead.message && <p className="tm-lead-body">{lead.message}</p>}

      {hasPitch && <Pitch lead={lead} save={save} busy={busy} errors={errors} />}
      {message && !errors.preview_url && !errors.current_site_url && <p className="field-error">{message}</p>}

      {lead.project ? (
        <p className="tm-lead-done">
          Now a project: <Link to={`/team/projects/${lead.project}`}>{lead.project_name}</Link>
          {lead.client && (
            <>
              {' · '}
              <Link to={`/team/clients/${lead.client}`}>Client page</Link>
            </>
          )}
          {lead.converted_at && <span className="pt-muted"> · since {formatDate(lead.converted_at)}</span>}
        </p>
      ) : (
        (lead.pitch_status === 'approved' || lead.status === 'won') && <Convert lead={lead} onDone={onSaved} />
      )}

      <div className="tm-lead-actions">
        <label className="field">
          Status
          <select value={lead.status} disabled={busy} onChange={(e) => save({ status: e.target.value })}>
            {STATUSES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Internal notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== lead.internal_notes && save({ internal_notes: notes })} placeholder="Call booked Friday…" />
        </label>
      </div>
      {!hasPitch && !lead.project && (
        <button type="button" className="tm-link-btn tm-lead-pitch-link" onClick={() => setPitching(true)}>
          Pitch them a redesign
        </button>
      )}
    </article>
  )
}

function Pitch({ lead, save, busy, errors }: {
  lead: Lead
  save: (fields: Partial<Lead>) => Promise<void>
  busy: boolean
  errors: Record<string, string>
}) {
  const [site, setSite] = useState(lead.current_site_url)
  const [preview, setPreview] = useState(lead.preview_url)
  const [feedback, setFeedback] = useState(lead.pitch_feedback)
  const current = lead.pitch_status || 'draft'
  const at = PITCH_STEPS.findIndex((p) => p.value === current)
  const locked = !!lead.project

  const saveUrl = (key: 'current_site_url' | 'preview_url', raw: string, set: (v: string) => void) => {
    const url = withScheme(raw.trim() || null)
    set(url)
    if (url !== lead[key]) save({ [key]: url, ...(lead.pitch_status ? {} : { pitch_status: 'draft' }) })
  }

  return (
    <section className="tm-pitch" aria-label="Redesign pitch">
      <div className="tm-pitch-head">
        <span className="tm-pitch-title">Redesign pitch</span>
        {lead.pitch_sent_at && <span className="pt-muted pt-small">Sent {formatDate(lead.pitch_sent_at)}</span>}
      </div>
      <ol className="tm-pitch-steps">
        {PITCH_STEPS.map((p, i) => (
          <li key={p.value} data-state={i < at ? 'done' : i === at ? 'now' : 'next'}>
            <button
              type="button"
              disabled={busy || locked}
              aria-current={i === at ? 'step' : undefined}
              onClick={() => p.value !== lead.pitch_status && save({ pitch_status: p.value, preview_url: withScheme(preview || null) })}
            >
              {p.label}
            </button>
          </li>
        ))}
      </ol>
      <p className="pt-muted pt-small tm-pitch-hint">{locked ? 'They went ahead. The links are saved on the project too.' : PITCH_STEPS[at]?.hint}</p>

      <div className="tm-pitch-links">
        <Field label="Their site today" error={errors.current_site_url}>
          <span className="tm-pitch-url">
            <input value={site} inputMode="url" placeholder="theirbusiness.com" disabled={locked} onChange={(e) => setSite(e.target.value)} onBlur={() => saveUrl('current_site_url', site, setSite)} />
            {lead.current_site_url && (
              <a href={lead.current_site_url} target="_blank" rel="noopener noreferrer" title={lead.current_site_url}>
                Open {hostOf(lead.current_site_url)}
              </a>
            )}
          </span>
        </Field>
        <Field label="Our redesign preview" error={errors.preview_url}>
          <span className="tm-pitch-url">
            <input value={preview} inputMode="url" placeholder="their-redesign.vercel.app" disabled={locked} onChange={(e) => setPreview(e.target.value)} onBlur={() => saveUrl('preview_url', preview, setPreview)} />
            {lead.preview_url && (
              <a href={lead.preview_url} target="_blank" rel="noopener noreferrer" title={lead.preview_url}>
                Open preview
              </a>
            )}
          </span>
        </Field>
      </div>
      {at >= 1 && (
        <Field label="What they said">
          <textarea
            className="tm-pitch-feedback"
            rows={2}
            value={feedback}
            disabled={locked}
            onChange={(e) => setFeedback(e.target.value)}
            onBlur={() => feedback !== lead.pitch_feedback && save({ pitch_feedback: feedback })}
            placeholder="Likes the new menu page. Wants their own photos and a WhatsApp button."
          />
        </Field>
      )}
    </section>
  )
}

function Convert({ lead, onDone }: { lead: Lead; onDone: () => void }) {
  const { busy, errors, message, run } = useMutation()
  const [open, setOpen] = useState(false)
  const redesign = !!(lead.current_site_url || lead.preview_url)
  const defaultName = `${redesign ? 'Website redesign' : lead.service_label}${lead.company_name ? ` for ${lead.company_name}` : ''}`

  if (!open) {
    return (
      <div className="tm-convert-cta">
        <button type="button" className="btn btn--sm" onClick={() => setOpen(true)}>
          Start the project
        </button>
        <span className="pt-muted pt-small">Turns {lead.full_name.split(' ')[0]} into a client and starts onboarding.</span>
      </div>
    )
  }

  return (
    <form
      className="tm-form tm-form--compact tm-convert"
      onSubmit={async (e) => {
        e.preventDefault()
        const f = formData(e)
        const ok = await run(`/api/v1/enquiries/inbox/${lead.id}/convert/`, {
          project_name: f.project_name ?? '',
          price: f.price,
          ...(f.deposit_percent ? { deposit_percent: Number(f.deposit_percent) } : {}),
          due_date: f.due_date,
        })
        if (ok) onDone()
      }}
    >
      <Field label="Project name" error={errors.project_name} wide>
        <input name="project_name" placeholder={defaultName} />
      </Field>
      <Field label="Agreed price, KES" error={errors.price}>
        <input name="price" inputMode="numeric" required placeholder="20000" />
      </Field>
      <Field label="Deposit %" error={errors.deposit_percent}>
        <input name="deposit_percent" inputMode="numeric" placeholder="30" />
      </Field>
      <Field label="Delivery date" error={errors.due_date}>
        <input name="due_date" type="date" />
      </Field>
      <div className="tm-form-actions tm-wide">
        <button type="submit" className="btn btn--sm" disabled={busy}>
          Make them a client
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <p className="pt-muted pt-small tm-wide">
        {message ||
          `Opens the project with ${redesign ? 'both site links' : 'their brief'}, drafts the deposit invoice and adds a kick-off task. ${lead.full_name.split(' ')[0]} gets an email to set a password and fill in onboarding.`}
      </p>
    </form>
  )
}
