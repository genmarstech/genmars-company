import { useState, type FormEvent } from 'react'
import { ApiError, postJson, type FieldErrors } from '../auth/session'
import { FormMessage } from '../auth/fields'
import { Icon } from '../components/Icon'
import { Link } from '../components/Link'
import { navigate } from '../router'
import { Empty, Loading, Panel, PortalLayout, StatusBadge } from './PortalLayout'
import { formatDate, kes, timeAgo, useApi } from './useApi'
import './orders.css'
import { orderTone, perMonth, type CatalogueService, type Order, type OrderDetail, type OrderStatus, type OrderUpdate } from './orderTypes'

/** Where an order is, as the client thinks about it. */
const STEPS: { label: string; statuses: OrderStatus[] }[] = [
  { label: 'Received', statuses: ['submitted', 'reviewing'] },
  { label: 'Quote', statuses: ['quoted'] },
  { label: 'Accepted', statuses: ['accepted'] },
  { label: 'In progress', statuses: ['in_progress'] },
  { label: 'Delivered', statuses: ['delivered', 'completed'] },
]

export function OrderSteps({ status }: { status: OrderStatus }) {
  if (status === 'declined' || status === 'cancelled') return null
  const at = STEPS.findIndex((s) => s.statuses.includes(status))
  return (
    <ol className="od-steps" aria-label="Order progress">
      {STEPS.map((s, i) => {
        const state = status === 'completed' || i < at ? 'done' : i === at ? 'now' : 'next'
        return (
          <li key={s.label} className={`od-step od-step--${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="od-step-dot" aria-hidden="true">
              {state === 'done' && <Icon name="check" size={12} strokeWidth={3} />}
            </span>
            {s.label}
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------- list

export function OrdersList() {
  const { data, error } = useApi<Order[]>('/api/v1/portal/orders/')

  return (
    <PortalLayout
      title="Orders"
      subtitle="Order a service, get a fixed quote, and follow it through to delivery."
      actions={
        <Link to="/portal/orders/new" className="btn btn--sm">
          Order a service <Icon name="arrow" size={16} />
        </Link>
      }
    >
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <Panel>
          <Empty>
            You haven’t ordered anything yet. <Link to="/portal/orders/new">Choose a service</Link> and tell us what you need.
            We reply with a fixed quote within one working day, and nothing is charged until you accept it.
          </Empty>
        </Panel>
      ) : (
        <Panel>
          <ul className="pt-list od-list">
            {data.map((o) => (
              <li key={o.id}>
                <Link to={`/portal/orders/${o.id}`} className="od-row">
                  <span className="od-row-main">
                    <strong>{o.service_name}</strong>
                    <span className="pt-muted pt-small">
                      {o.number} · ordered {formatDate(o.created_at)}
                    </span>
                  </span>
                  <span className="od-row-price pt-num">
                    {o.quoted_price ? `${kes(o.quoted_price)}${perMonth(o)}` : <span className="pt-muted">From {kes(o.starting_price)}</span>}
                  </span>
                  <StatusBadge tone={orderTone[o.status]}>{o.status === 'quoted' && !o.quote_expired ? 'Quote ready, needs you' : o.status_label}</StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="pt-muted pt-small pt-note">
        Need something that isn’t listed? <Link to="/portal/requests">Send us a general request</Link>.
      </p>
    </PortalLayout>
  )
}

// ---------------------------------------------------------------- new order

export function NewOrder() {
  const { data: catalogue, error } = useApi<CatalogueService[]>('/api/v1/services/')
  const [picked, setPicked] = useState(() => new URLSearchParams(window.location.search).get('service') ?? '')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState('')
  const service = catalogue?.find((s) => s.slug === picked) ?? null

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!service) return
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const body = {
      service: service.slug,
      brief: raw.brief,
      links: raw.links.trim(),
      budget: raw.budget.replace(/[^\d.]/g, '') || null,
      wanted_by: raw.wanted_by || null,
    }
    setBusy(true)
    setErrors({})
    setNotice('')
    try {
      const order = await postJson<Order>('/api/v1/portal/orders/', body)
      navigate(`/portal/orders/${order.id}?placed=1`)
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields)
        setNotice(err.message || err.fields.service || 'Please check the highlighted fields.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <PortalLayout title="Order a service" subtitle="Pick a service, tell us what you need, and we’ll send a fixed quote.">
      <Link to="/portal/orders" className="pt-back">
        ← Your orders
      </Link>
      {!catalogue ? (
        <Loading error={error} />
      ) : (
        <div className="od-new">
          <fieldset className="od-services">
            <legend className="od-legend">1. Choose a service</legend>
            {catalogue.map((s) => (
              <label key={s.slug} className="od-service" data-picked={s.slug === picked}>
                <input type="radio" name="service" value={s.slug} checked={s.slug === picked} onChange={() => setPicked(s.slug)} />
                <span className="od-service-name">{s.name}</span>
                <span className="od-service-price">
                  From {kes(s.starting_price)}
                  {perMonth(s)}
                </span>
                <span className="od-service-text">{s.summary}</span>
              </label>
            ))}
          </fieldset>

          <div className="od-brief">
            <Panel title="2. Tell us what you need">
              {!service ? (
                <Empty>Choose a service on the left to continue.</Empty>
              ) : (
                <form className="pt-form" onSubmit={submit}>
                  {notice && <FormMessage tone="error">{notice}</FormMessage>}
                  <label className="field" data-invalid={!!errors.brief}>
                    What should we build, and what is it for?
                    <textarea
                      name="brief"
                      rows={6}
                      required
                      minLength={20}
                      placeholder={placeholderFor(service.key)}
                    />
                    {errors.brief && <span className="field-error">{errors.brief}</span>}
                  </label>
                  <label className="field" data-invalid={!!errors.links}>
                    <span>
                      Links we should look at <span className="pt-muted">(optional)</span>
                    </span>
                    <input name="links" placeholder="Your current site, a competitor you like, a shared folder" />
                  </label>
                  <div className="od-pair">
                    <label className="field" data-invalid={!!errors.budget}>
                      <span>
                      Budget in KES <span className="pt-muted">(optional)</span>
                    </span>
                      <input name="budget" inputMode="numeric" placeholder={Number(service.starting_price).toLocaleString('en-KE')} />
                      {errors.budget && <span className="field-error">{errors.budget}</span>}
                    </label>
                    <label className="field" data-invalid={!!errors.wanted_by}>
                      <span>
                      Needed by <span className="pt-muted">(optional)</span>
                    </span>
                      <input name="wanted_by" type="date" min={new Date().toISOString().slice(0, 10)} />
                      {errors.wanted_by && <span className="field-error">{errors.wanted_by}</span>}
                    </label>
                  </div>
                  <button type="submit" className="btn btn--sm" disabled={busy}>
                    {busy ? 'Placing order…' : 'Place order'}
                  </button>
                </form>
              )}
            </Panel>

            {service && (
              <aside className="pt-panel od-summary" aria-label="What happens next">
                <span className="od-summary-label">{service.name}</span>
                <span className="od-summary-price">
                  From {kes(service.starting_price)}
                  <span className="pt-muted">{perMonth(service)}</span>
                </span>
                {service.timeline && <span className="pt-muted pt-small">Usually {service.timeline.toLowerCase()}</span>}
                {service.includes.length > 0 && (
                  <ul className="od-includes">
                    {service.includes.map((i) => (
                      <li key={i}>
                        <Icon name="check" size={14} strokeWidth={2.4} /> {i}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="pt-small od-next">
                  We read your brief and reply with a fixed price within one working day. Nothing is charged until you
                  accept it
                  {service.deposit_percent > 0 && service.billing === 'once'
                    ? `, and then a ${service.deposit_percent}% deposit starts the work.`
                    : '.'}
                </p>
              </aside>
            )}
          </div>
        </div>
      )}
    </PortalLayout>
  )
}

function placeholderFor(key: string) {
  switch (key) {
    case 'website':
      return 'e.g. A five-page site for our clinic with opening hours, services, and a booking form.'
    case 'ecommerce':
      return 'e.g. We sell about 200 products and want customers to pay by M-Pesa and get delivery updates.'
    case 'automation':
      return 'e.g. Our leave requests go through paper forms and WhatsApp. We want one place to request and approve them.'
    case 'maintenance':
      return 'e.g. Our site runs on WordPress. We need updates, backups and someone to call when something breaks.'
    case 'ui_ux':
      return 'e.g. Our app works but customers get lost at checkout. We want the flow redesigned and tested.'
    case 'cloud':
      return 'e.g. Move our system from a shared host to a proper server, with backups and our own email.'
    default:
      return 'e.g. A system to track stock across our three shops, with daily sales reports for the owners.'
  }
}

// ---------------------------------------------------------------- one order

export function OrderDetailPage({ id }: { id: string }) {
  const { data: loaded, error } = useApi<OrderDetail>(`/api/v1/portal/orders/${id}/`)
  const [fresh, setFresh] = useState<OrderDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [declining, setDeclining] = useState(false)
  const order = fresh ?? loaded
  const justPlaced = new URLSearchParams(window.location.search).get('placed') === '1'

  async function act(path: string, body: unknown = {}) {
    setBusy(true)
    setProblem('')
    try {
      setFresh(await postJson<OrderDetail>(`/api/v1/portal/orders/${id}/${path}/`, body))
      return true
    } catch (err) {
      if (err instanceof ApiError) setProblem(err.message || Object.values(err.fields)[0] || 'That didn’t work. Try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <PortalLayout
      title={order ? order.service_name : 'Order'}
      subtitle={order ? `${order.number} · ordered ${formatDate(order.created_at)}` : undefined}
      actions={order && <StatusBadge tone={orderTone[order.status]}>{order.status_label}</StatusBadge>}
    >
      <Link to="/portal/orders" className="pt-back">
        ← Your orders
      </Link>
      {!order ? (
        <Loading error={error} />
      ) : (
        <>
          {justPlaced && order.status === 'submitted' && (
            <FormMessage tone="ok">Order placed. We’ve emailed you a copy and will reply with a quote within one working day.</FormMessage>
          )}
          <OrderSteps status={order.status} />
          {problem && <FormMessage tone="error">{problem}</FormMessage>}

          <div className="pt-detail">
            <div className="od-col">
              {order.status === 'quoted' && (
                <section className="pt-panel od-quote" aria-label="Your quote">
                  <span className="od-summary-label">Your fixed quote</span>
                  <span className="od-quote-price">
                    {kes(order.quoted_price)}
                    <span className="pt-muted">{perMonth(order)}</span>
                  </span>
                  {order.quote_note && <p className="od-quote-note">{order.quote_note}</p>}
                  <p className="pt-muted pt-small">
                    {order.deposit && `A ${kes(order.deposit)} deposit starts the work, the rest is paid at agreed milestones. `}
                    {order.quote_expired
                      ? `This quote expired on ${formatDate(order.quote_valid_until)}. Send us a note below and we’ll refresh it.`
                      : `Valid until ${formatDate(order.quote_valid_until)}.`}
                  </p>
                  {!order.quote_expired && !declining && (
                    <div className="od-quote-actions">
                      <button type="button" className="btn btn--sm" disabled={busy} onClick={() => act('accept')}>
                        Accept quote
                      </button>
                      <button type="button" className="btn btn--sm btn--ghost" disabled={busy} onClick={() => setDeclining(true)}>
                        Decline
                      </button>
                    </div>
                  )}
                  {declining && (
                    <form
                      className="pt-form od-decline"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        const reason = String(new FormData(e.currentTarget).get('reason') ?? '')
                        if (await act('decline', { reason })) setDeclining(false)
                      }}
                    >
                      <label className="field">
                        <span>
                          What would make it work for you? <span className="pt-muted">(optional)</span>
                        </span>
                        <textarea name="reason" rows={3} placeholder="e.g. Over our budget right now, could we start smaller?" />
                      </label>
                      <div className="od-quote-actions">
                        <button type="submit" className="btn btn--sm" disabled={busy}>
                          Decline quote
                        </button>
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setDeclining(false)}>
                          Keep it
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              )}

              {order.project && (
                <Panel>
                  <p className="od-project">
                    Your project is set up. Follow its milestones, files and previews on the{' '}
                    <Link to={`/portal/projects/${order.project}`}>project page</Link>.
                  </p>
                </Panel>
              )}

              <Panel title="Updates">
                <OrderTimeline updates={order.updates} />
                {order.status !== 'cancelled' && order.status !== 'completed' && (
                  <CommentBox busy={busy} onSend={(body) => act('comment', { body })} />
                )}
              </Panel>
            </div>

            <div className="pt-side-col">
              <Panel title="Your brief">
                <p className="od-brief-text">{order.brief}</p>
                <dl className="pt-info">
                  <dt>Starting price</dt>
                  <dd>
                    {kes(order.starting_price)}
                    {perMonth(order)}
                  </dd>
                  <dt>Your budget</dt>
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
              {order.can_cancel && (
                <p className="pt-small">
                  <button
                    type="button"
                    className="tm-link-btn tm-danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Cancel this order?')) act('cancel')
                    }}
                  >
                    Cancel this order
                  </button>
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </PortalLayout>
  )
}

export function OrderTimeline({ updates, team = false }: { updates: OrderUpdate[]; team?: boolean }) {
  if (updates.length === 0) return <Empty>Nothing yet.</Empty>
  return (
    <ol className="od-timeline">
      {[...updates].reverse().map((u) => (
        <li key={u.id} className={`od-ev od-ev--${u.kind}${u.internal ? ' od-ev--internal' : ''}`}>
          <div className="od-ev-head">
            <strong>{u.kind === 'comment' ? u.author_name : u.kind === 'quote' ? 'Quote sent' : u.status_label}</strong>
            {u.internal && <span className="od-private">Team only</span>}
            <span className="pt-muted pt-small" title={new Date(u.created_at).toLocaleString('en-GB')}>
              {timeAgo(u.created_at)}
              {u.kind !== 'comment' && team && u.author_name ? ` · ${u.author_name}` : ''}
            </span>
          </div>
          {u.body && u.body !== 'Order placed' && <p className="od-ev-body">{u.body}</p>}
        </li>
      ))}
    </ol>
  )
}

export function CommentBox({ busy, onSend, team = false }: { busy: boolean; onSend: (body: string, internal: boolean) => Promise<boolean>; team?: boolean }) {
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  return (
    <form
      className="od-comment"
      onSubmit={async (e) => {
        e.preventDefault()
        if (body.trim() && (await onSend(body, internal))) setBody('')
      }}
    >
      <label className="sr-only" htmlFor="od-comment">
        {team ? 'Write to the client or add a note' : 'Write to the team'}
      </label>
      <textarea
        id="od-comment"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={team ? (internal ? 'Note for the team only…' : 'Write to the client…') : 'Ask a question or add a detail…'}
      />
      <div className="od-comment-foot">
        {team && (
          <label className="od-check">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Team only
          </label>
        )}
        <button type="submit" className="btn btn--sm" disabled={busy || !body.trim()}>
          {team && !internal ? 'Send to client' : team ? 'Save note' : 'Send'}
        </button>
      </div>
    </form>
  )
}
