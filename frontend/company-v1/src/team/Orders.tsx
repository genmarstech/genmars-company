import { useState } from 'react'
import { ApiError, postJson } from '../auth/session'
import { FormMessage } from '../auth/fields'
import { Link } from '../components/Link'
import { CommentBox, OrderSteps, OrderTimeline } from '../portal/Orders'
import { orderTone, perMonth, type CatalogueService, type Order, type OrderDetail } from '../portal/orderTypes'
import { Empty, Loading, Panel, StatusBadge, TeamLayout } from '../portal/PortalLayout'
import { formatDate, kes, timeAgo, useApi } from '../portal/useApi'
import { Field } from './Field'
import { formData, useMutation } from './shared'
import type { Staff } from './types'

type TeamOrder = Order & {
  client: number
  client_name: string
  client_email: string
  client_phone: string
  company_name: string
  assignee: number | null
  assignee_name: string
  project_name: string
}
type TeamOrderDetail = TeamOrder & OrderDetail

const VIEWS = [
  { value: 'open', label: 'Open' },
  { value: 'needs_quote', label: 'Needs a quote' },
  { value: 'with_client', label: 'With client' },
  { value: 'to_start', label: 'Ready to start' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
  { value: '', label: 'All' },
]

// statuses the team can move an order to by hand; quotes and starts have their own buttons
const MANUAL = [
  { value: 'submitted', label: 'Received' },
  { value: 'reviewing', label: 'Under review' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

/** What the team should do next with an order, in a few words. */
function nextStep(o: Order) {
  switch (o.status) {
    case 'submitted':
    case 'reviewing':
      return 'Write a quote'
    case 'quoted':
      return o.quote_expired ? 'Quote expired' : 'Waiting on client'
    case 'accepted':
      return 'Start the project'
    case 'in_progress':
      return 'Deliver'
    case 'delivered':
      return 'Confirm and close'
    default:
      return ''
  }
}

export function TeamOrders() {
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') ?? 'open')
  const { data, error } = useApi<TeamOrder[]>(`/api/v1/team/orders/${view ? `?view=${view}` : ''}`)

  return (
    <TeamLayout
      title="Orders"
      subtitle="Services clients ordered from their portal. Quote them, then start the project."
      actions={
        <label className="pt-filter">
          <span className="sr-only">Show</span>
          <select value={view} onChange={(e) => setView(e.target.value)}>
            {VIEWS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <Panel>
        {!data ? (
          <Loading error={error} />
        ) : data.length === 0 ? (
          <Empty>No orders here.</Empty>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table pt-stack od-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Client</th>
                  <th scope="col" className="pt-num">Price</th>
                  <th scope="col">Status</th>
                  <th scope="col">Next</th>
                  <th scope="col">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id}>
                    <td data-label="Order">
                      <Link to={`/team/orders/${o.id}`} className="od-cell-link">
                        <strong>{o.service_name}</strong>
                        <span className="pt-muted pt-small">
                          {o.number} · {timeAgo(o.created_at)}
                        </span>
                      </Link>
                    </td>
                    <td data-label="Client">
                      <Link to={`/team/clients/${o.client}`}>{o.client_name}</Link>
                      {o.company_name && <span className="pt-muted pt-small pt-block">{o.company_name}</span>}
                    </td>
                    <td data-label="Price" className="pt-num">
                      {o.quoted_price ? `${kes(o.quoted_price)}${perMonth(o)}` : <span className="pt-muted">from {kes(o.starting_price)}</span>}
                    </td>
                    <td data-label="Status">
                      <StatusBadge tone={orderTone[o.status]}>{o.status_label}</StatusBadge>
                    </td>
                    <td data-label="Next" className="pt-small">{nextStep(o)}</td>
                    <td data-label="Owner" className="pt-small">{o.assignee_name ? o.assignee_name.split(' ')[0] : <span className="pt-muted">Nobody</span>}</td>
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

export function TeamOrderDetail({ id }: { id: string }) {
  const { data: loaded, error } = useApi<TeamOrderDetail>(`/api/v1/team/orders/${id}/`)
  const staff = useApi<Staff[]>('/api/v1/team/staff/')
  const [fresh, setFresh] = useState<TeamOrderDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const order = fresh ?? loaded

  async function send(path: string, body: unknown, method = 'POST') {
    setBusy(true)
    setProblem('')
    setFieldErrors({})
    try {
      setFresh(await postJson<TeamOrderDetail>(`/api/v1/team/orders/${id}/${path}`, body, method))
      return true
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields)
        setProblem(err.message || Object.values(err.fields)[0] || 'That didn’t work. Try again.')
      }
      return false
    } finally {
      setBusy(false)
    }
  }

  const canQuote = order && ['submitted', 'reviewing', 'quoted'].includes(order.status)

  return (
    <TeamLayout
      title={order ? `${order.service_name} for ${order.client_name}` : 'Order'}
      subtitle={order ? `${order.number} · ordered ${formatDate(order.created_at)}` : undefined}
      actions={order && <StatusBadge tone={orderTone[order.status]}>{order.status_label}</StatusBadge>}
    >
      <Link to="/team/orders" className="pt-back">
        ← All orders
      </Link>
      {!order ? (
        <Loading error={error} />
      ) : (
        <>
          <OrderSteps status={order.status} />
          {problem && <FormMessage tone="error">{problem}</FormMessage>}
          <div className="pt-detail">
            <div className="od-col">
              <Panel title="Brief">
                <p className="od-brief-text">{order.brief}</p>
                <dl className="pt-info">
                  <dt>Starting price</dt>
                  <dd>
                    {kes(order.starting_price)}
                    {perMonth(order)}
                  </dd>
                  <dt>Client’s budget</dt>
                  <dd>{order.budget ? kes(order.budget) : 'Not given'}</dd>
                  <dt>Needed by</dt>
                  <dd>{order.wanted_by ? formatDate(order.wanted_by) : 'No date given'}</dd>
                  {order.links && (
                    <>
                      <dt>Links</dt>
                      <dd className="od-links">{order.links}</dd>
                    </>
                  )}
                </dl>
              </Panel>

              {canQuote && (
                <Panel title={order.quoted_price ? 'Revise the quote' : 'Send a quote'}>
                  <form
                    className="tm-form tm-form--compact"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const f = formData(e)
                      send('quote/', { price: f.price, note: f.note ?? '', valid_until: f.valid_until })
                    }}
                  >
                    <Field label={`Fixed price, KES${order.billing === 'monthly' ? ' a month' : ''}`} error={fieldErrors.price}>
                      <input name="price" inputMode="numeric" required defaultValue={order.quoted_price ? Number(order.quoted_price) : ''} placeholder={String(Number(order.starting_price))} />
                    </Field>
                    <Field label="Valid until" error={fieldErrors.valid_until}>
                      <input name="valid_until" type="date" defaultValue={order.quote_valid_until ?? ''} />
                    </Field>
                    <Field label="What the price covers (the client sees this)" wide>
                      <textarea name="note" rows={4} defaultValue={order.quote_note} placeholder="Five pages, a product catalogue, an enquiry form, and two rounds of changes." />
                    </Field>
                    <div className="tm-form-actions tm-wide">
                      <button type="submit" className="btn btn--sm" disabled={busy}>
                        {order.quoted_price ? 'Send revised quote' : 'Send quote'}
                      </button>
                      <span className="pt-muted pt-small">The client gets an email and can accept it from their portal. Leave the date empty for 30 days.</span>
                    </div>
                  </form>
                </Panel>
              )}

              {order.status === 'accepted' && (
                <Panel title="Start the project">
                  <form
                    className="tm-form tm-form--compact"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const f = formData(e)
                      send('start/', { name: f.name ?? '', due_date: f.due_date, deposit_invoice: f.deposit_invoice === 'on' })
                    }}
                  >
                    <Field label="Project name">
                      <input name="name" placeholder={`${order.service_name}${order.company_name ? ` for ${order.company_name}` : ''}`} />
                    </Field>
                    <Field label="Delivery date">
                      <input name="due_date" type="date" defaultValue={order.wanted_by ?? ''} />
                    </Field>
                    {order.deposit && (
                      <label className="od-check tm-wide">
                        <input type="checkbox" name="deposit_invoice" defaultChecked /> Draft a {kes(order.deposit)} deposit invoice
                      </label>
                    )}
                    <div className="tm-form-actions tm-wide">
                      <button type="submit" className="btn btn--sm" disabled={busy}>
                        Start project
                      </button>
                      <span className="pt-muted pt-small">Creates the project in the client’s portal and a kick-off task for the owner.</span>
                    </div>
                  </form>
                </Panel>
              )}

              {order.quoted_price && !canQuote && (
                <Panel title="Agreed price">
                  <p className="od-quote-price">
                    {kes(order.quoted_price)}
                    <span className="pt-muted">{perMonth(order)}</span>
                  </p>
                  {order.quote_note && <p className="od-quote-note">{order.quote_note}</p>}
                  {order.accepted_at && <p className="pt-muted pt-small">Accepted {formatDate(order.accepted_at)}</p>}
                </Panel>
              )}

              <Panel title="Timeline">
                <OrderTimeline updates={order.updates} team />
                <CommentBox team busy={busy} onSend={(body, internal) => send('comment/', { body, internal })} />
              </Panel>
            </div>

            <div className="pt-side-col">
              <Panel title="Client">
                <p className="od-client">
                  <Link to={`/team/clients/${order.client}`}>
                    <strong>{order.client_name}</strong>
                  </Link>
                  {order.company_name && <span className="pt-muted pt-small">{order.company_name}</span>}
                  <a href={`mailto:${order.client_email}`} className="pt-small">
                    {order.client_email}
                  </a>
                  {order.client_phone && (
                    <a href={`tel:${order.client_phone}`} className="pt-small">
                      {order.client_phone}
                    </a>
                  )}
                </p>
              </Panel>
              <Panel title="Handling">
                <div className="tm-form tm-form--stack">
                  <Field label="Owner" error={fieldErrors.assignee}>
                    <select value={order.assignee ?? ''} disabled={busy} onChange={(e) => send('', { assignee: e.target.value ? Number(e.target.value) : null }, 'PATCH')}>
                      <option value="">Nobody yet</option>
                      {staff.data?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status" error={fieldErrors.status}>
                    <select value={order.status} disabled={busy} onChange={(e) => send('', { status: e.target.value }, 'PATCH')}>
                      {!MANUAL.some((m) => m.value === order.status) && <option value={order.status}>{order.status_label}</option>}
                      {MANUAL.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="pt-muted pt-small">The client is emailed when the status changes to under review, in progress, delivered, completed or cancelled.</p>
                </div>
              </Panel>
              {order.project && (
                <Panel title="Project">
                  <Link to={`/team/projects/${order.project}`}>{order.project_name}</Link>
                </Panel>
              )}
            </div>
          </div>
        </>
      )}
    </TeamLayout>
  )
}

// ---------------------------------------------------------------- catalogue

export function TeamServices() {
  const { data, error, reload } = useApi<CatalogueService[]>('/api/v1/team/services/')

  return (
    <TeamLayout title="Services & prices" subtitle="What clients can order from their portal, and the starting price they see.">
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="od-svc-list">
          {data.map((s) => (
            <ServiceEditor key={s.id} service={s} onSaved={reload} />
          ))}
        </div>
      )}
    </TeamLayout>
  )
}

function ServiceEditor({ service, onSaved }: { service: CatalogueService; onSaved: () => void }) {
  const { busy, errors, message, run } = useMutation()
  const [saved, setSaved] = useState(false)

  return (
    <Panel title={service.name} action={!service.is_active && <StatusBadge tone="gray">Hidden</StatusBadge>}>
      <form
        className="tm-form tm-form--compact"
        onSubmit={async (e) => {
          e.preventDefault()
          const f = formData(e)
          const body = {
            name: f.name,
            summary: f.summary ?? '',
            starting_price: f.starting_price,
            billing: f.billing,
            deposit_percent: Number(f.deposit_percent ?? 0),
            timeline: f.timeline ?? '',
            includes: (f.includes ?? '').split('\n'),
            is_active: f.is_active === 'on',
          }
          setSaved(false)
          if (await run(`/api/v1/team/services/${service.id}/`, body, 'PATCH')) {
            setSaved(true)
            onSaved()
          }
        }}
      >
        <Field label="Name" error={errors.name}>
          <input name="name" defaultValue={service.name} required />
        </Field>
        <Field label="Starts from, KES" error={errors.starting_price}>
          <input name="starting_price" inputMode="numeric" defaultValue={Number(service.starting_price)} required />
        </Field>
        <Field label="Billed">
          <select name="billing" defaultValue={service.billing}>
            <option value="once">One-off</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <Field label="Deposit %" error={errors.deposit_percent}>
          <input name="deposit_percent" inputMode="numeric" defaultValue={service.deposit_percent} />
        </Field>
        <Field label="Typical timeline">
          <input name="timeline" defaultValue={service.timeline} />
        </Field>
        <Field label="Short description" wide>
          <input name="summary" defaultValue={service.summary} />
        </Field>
        <Field label="What’s included, one per line" error={errors.includes} wide>
          <textarea name="includes" rows={4} defaultValue={service.includes.join('\n')} />
        </Field>
        <div className="tm-form-actions tm-wide">
          <label className="od-check">
            <input type="checkbox" name="is_active" defaultChecked={service.is_active} /> Clients can order this
          </label>
          <button type="submit" className="btn btn--sm tm-push" disabled={busy}>
            Save
          </button>
          {saved && !message && <span className="pt-muted pt-small">Saved</span>}
          {message && <span className="field-error">{message}</span>}
        </div>
      </form>
    </Panel>
  )
}
