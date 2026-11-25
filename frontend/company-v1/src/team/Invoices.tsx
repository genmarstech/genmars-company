import { useState, type FormEvent } from 'react'
import { Empty, Loading, Panel, TeamLayout } from '../portal/PortalLayout'
import { formatDate, kes, useApi } from '../portal/useApi'
import { Field } from './Field'
import { formData, useMutation, useScrollToHash } from './shared'
import type { TeamClient, TeamInvoice, TeamProject } from './types'

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
]

export function TeamInvoices() {
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).get('new') === '1')
  const { data, error, reload } = useApi<TeamInvoice[]>('/api/v1/team/invoices/')
  const { busy, run } = useMutation()
  useScrollToHash(!!data)
  const outstanding = data?.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((t, i) => t + Number(i.amount), 0) ?? 0

  const setStatus = async (inv: TeamInvoice, status: string) => {
    if (await run(`/api/v1/team/invoices/${inv.id}/`, { status }, 'PATCH')) reload()
  }

  return (
    <TeamLayout
      title="Invoices"
      subtitle={data ? `${kes(outstanding)} outstanding. Drafts stay hidden from clients until you mark them sent.` : undefined}
      actions={
        <button type="button" className="btn btn--sm" onClick={() => setCreating((c) => !c)}>
          {creating ? 'Close' : 'New invoice'}
        </button>
      }
    >
      {creating && (
        <NewInvoice
          nextNumber={`GM-${new Date().getFullYear()}-${String((data?.length ?? 0) + 1).padStart(3, '0')}`}
          onCreated={() => {
            setCreating(false)
            reload()
          }}
        />
      )}
      <Panel>
        {!data ? (
          <Loading error={error} />
        ) : data.length === 0 ? (
          <Empty>No invoices yet.</Empty>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Client</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Due</th>
                  <th scope="col" className="pt-num">Amount</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((i) => (
                  <tr key={i.id} id={`invoice-${i.id}`}>
                    <td>
                      <strong>{i.number}</strong>
                      <span className="pt-muted pt-small pt-block">{i.description || i.project_name || '—'}</span>
                    </td>
                    <td>{i.client_name}</td>
                    <td>{formatDate(i.issued_on)}</td>
                    <td>{i.status === 'paid' ? `Paid ${formatDate(i.paid_on)}` : formatDate(i.due_on)}</td>
                    <td className="pt-num">{kes(i.amount)}</td>
                    <td>
                      <span className="tm-status-edit">
                        <select aria-label={`Change status of ${i.number}`} value={i.status} disabled={busy} onChange={(e) => setStatus(i, e.target.value)}>
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </span>
                    </td>
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

function NewInvoice({ nextNumber, onCreated }: { nextNumber: string; onCreated: () => void }) {
  const clients = useApi<TeamClient[]>('/api/v1/team/clients/')
  const [client, setClient] = useState('')
  const projects = useApi<TeamProject[]>(client ? `/api/v1/team/projects/?client=${client}` : null)
  const { busy, errors, message, run } = useMutation()

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const body = formData(e)
    const created = await run('/api/v1/team/invoices/', {
      ...body,
      client: Number(body.client),
      project: body.project ? Number(body.project) : null,
      issued_on: body.issued_on ?? new Date().toISOString().slice(0, 10),
    })
    if (created) onCreated()
  }

  return (
    <Panel title="New invoice">
      <form className="tm-form" onSubmit={submit}>
        {message && <p className="pt-error tm-wide">{message}</p>}
        <Field label="Client" error={errors.client}>
          <select name="client" required value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Choose a client</option>
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project (optional)" error={errors.project}>
          <select name="project" defaultValue="" disabled={!projects.data}>
            <option value="">—</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Invoice number" error={errors.number}>
          <input name="number" required defaultValue={nextNumber} />
        </Field>
        <Field label="Amount (KES)" error={errors.amount}>
          <input name="amount" type="number" min="1" step="1" required />
        </Field>
        <Field label="Issued on">
          <input name="issued_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Due on">
          <input name="due_on" type="date" />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue="sent">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment link (optional)" error={errors.payment_link}>
          <input name="payment_link" type="url" placeholder="https://…" />
        </Field>
        <Field label="Description" wide>
          <input name="description" placeholder="Design milestone" />
        </Field>
        <button type="submit" className="btn btn--sm" disabled={busy}>
          {busy ? 'Saving…' : 'Create invoice'}
        </button>
      </form>
    </Panel>
  )
}
