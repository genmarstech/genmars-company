import { useState, type FormEvent } from 'react'
import { ApiError, postJson, type FieldErrors } from '../auth/session'
import { FormMessage } from '../auth/fields'
import { budgetRanges, services } from '../data/site'
import { Empty, Loading, Panel, PortalLayout, StatusBadge } from './PortalLayout'
import { formatDate, useApi } from './useApi'

type ProjectRequest = {
  id: number
  service: string
  service_label: string
  budget_label: string
  message: string
  status: string
  status_label: string
  created_at: string
}

const tone: Record<string, string> = { new: 'blue', contacted: 'amber', proposal_sent: 'amber', won: 'green', lost: 'gray' }
// what each lead status means from the client's side
const clientStatus: Record<string, string> = {
  new: 'Received',
  contacted: 'In discussion',
  proposal_sent: 'Proposal sent',
  won: 'Approved',
  lost: 'Closed',
}

export function Requests() {
  const { data, error, reload } = useApi<ProjectRequest[]>('/api/v1/portal/requests/')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const body = Object.fromEntries(new FormData(form))
    setBusy(true)
    setErrors({})
    setNotice(null)
    try {
      await postJson('/api/v1/portal/requests/', body)
      form.reset()
      setNotice({ tone: 'ok', text: 'Request sent. We’ll reply within one working day with next steps.' })
      reload()
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields)
        setNotice({ tone: 'error', text: err.message || 'Please check the highlighted fields.' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <PortalLayout title="New request" subtitle="Ask for a new project or an addition to an existing one.">
      <div className="pt-detail">
        <Panel title="Tell us what you need">
          <form className="pt-form" onSubmit={submit}>
            {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}
            <label className="field">
              Service
              <select name="service" defaultValue={services[0].apiValue}>
                {services.map((s) => (
                  <option key={s.slug} value={s.apiValue}>
                    {s.title}
                  </option>
                ))}
                <option value="other">Something else</option>
              </select>
            </label>
            <label className="field">
              Budget
              <select name="budget" defaultValue="unsure">
                {budgetRanges.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" data-invalid={!!errors.message}>
              What should we build, and by when?
              <textarea name="message" rows={5} required minLength={10} placeholder="e.g. Add online payments to our booking site before March" />
              {errors.message && <span className="field-error">{errors.message}</span>}
            </label>
            <button type="submit" className="btn btn--sm" disabled={busy}>
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </form>
        </Panel>

        <Panel title="Your requests">
          {!data ? (
            <Loading error={error} />
          ) : data.length === 0 ? (
            <Empty>Requests you send appear here with their status.</Empty>
          ) : (
            <ul className="pt-list pt-requests">
              {data.map((r) => (
                <li key={r.id}>
                  <div className="pt-request-top">
                    <strong>{r.service_label}</strong>
                    <StatusBadge tone={tone[r.status] ?? 'gray'}>{clientStatus[r.status] ?? r.status_label}</StatusBadge>
                  </div>
                  <p className="pt-muted pt-small">
                    {formatDate(r.created_at)} · {r.budget_label}
                  </p>
                  <p className="pt-request-msg">{r.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalLayout>
  )
}
