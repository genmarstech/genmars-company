import { useState } from 'react'
import { Empty, Loading, Panel, StatusBadge, TeamLayout } from '../portal/PortalLayout'
import { formatDate, useApi } from '../portal/useApi'
import { useMutation } from './shared'
import type { Lead } from './types'

const STATUSES = [
  { value: 'new', label: 'New', tone: 'blue' },
  { value: 'contacted', label: 'Contacted', tone: 'amber' },
  { value: 'proposal_sent', label: 'Proposal sent', tone: 'amber' },
  { value: 'won', label: 'Won', tone: 'green' },
  { value: 'lost', label: 'Lost', tone: 'gray' },
]

export function Leads() {
  const [status, setStatus] = useState('')
  const { data, error, reload } = useApi<Lead[]>(`/api/v1/enquiries/inbox/${status ? `?status=${status}` : ''}`)

  return (
    <TeamLayout
      title="Leads"
      subtitle="Project briefs sent from the website."
      actions={
        <label className="pt-filter">
          <span className="sr-only">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All leads</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <Panel>
          <Empty>No leads here yet.</Empty>
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

function LeadCard({ lead, onSaved }: { lead: Lead; onSaved: () => void }) {
  const { busy, run } = useMutation()
  const [notes, setNotes] = useState(lead.internal_notes)
  const s = STATUSES.find((x) => x.value === lead.status)

  const save = async (fields: Partial<Lead>) => {
    if (await run(`/api/v1/enquiries/inbox/${lead.id}/`, fields, 'PATCH')) onSaved()
  }

  return (
    <article className="pt-panel tm-lead">
      <div className="tm-lead-top">
        <div>
          <h2>{lead.full_name}</h2>
          <span className="pt-muted pt-small">
            <a href={`mailto:${lead.email}`}>{lead.email}</a>
            {lead.phone_number && ` · ${lead.phone_number}`} · {formatDate(lead.created_at)}
          </span>
        </div>
        <StatusBadge tone={s?.tone ?? 'gray'}>{s?.label ?? lead.status}</StatusBadge>
      </div>
      <p className="tm-lead-meta">
        <strong>{lead.service_label}</strong> · {lead.budget_label}
      </p>
      <p className="tm-lead-body">{lead.message}</p>
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
    </article>
  )
}
