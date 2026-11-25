import { useState } from 'react'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, TeamLayout } from '../portal/PortalLayout'
import { formatDate, kes, useApi } from '../portal/useApi'

type Finance = {
  paid_this_month: string | number
  paid_this_year: string | number
  outstanding: string | number
  overdue: string | number
  overdue_count: number
  months: { month: string; paid: string | number }[]
  overdue_invoices: { id: number; number: string; client: string; amount: string; due_on: string | null }[]
}

export function FinancePage() {
  const { data, error } = useApi<Finance>('/api/v1/team/finance/')

  return (
    <TeamLayout title="Finance" subtitle="Money received and money owed, from your invoices.">
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="pt-stats">
            <Stat label="Paid this month" value={kes(data.paid_this_month)} />
            <Stat label="Paid this year" value={kes(data.paid_this_year)} />
            <Stat label="Outstanding" value={kes(data.outstanding)} />
            <Stat label="Overdue" value={kes(data.overdue)} note={`${data.overdue_count} invoice${data.overdue_count === 1 ? '' : 's'}`} tone={Number(data.overdue) ? 'bad' : undefined} />
          </div>
          <div className="pt-two">
            <Panel title="Payments received · last 6 months">
              <MonthlyBars months={data.months.map((m) => ({ month: m.month, paid: Number(m.paid) }))} />
            </Panel>
            <Panel
              title="Overdue invoices"
              action={
                <Link to="/team/invoices" className="pt-more">
                  All invoices
                </Link>
              }
            >
              {data.overdue_invoices.length === 0 ? (
                <Empty>Nothing overdue.</Empty>
              ) : (
                <ul className="pt-list tm-overdue-list">
                  {data.overdue_invoices.map((i) => (
                    <li key={i.id}>
                      <span>
                        <strong>{i.number}</strong>
                        <span className="pt-muted pt-small pt-block">
                          {i.client} · due {formatDate(i.due_on, false)}
                        </span>
                      </span>
                      <span className="pt-num">{kes(i.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </TeamLayout>
  )
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'bad' }) {
  return (
    <div className="pt-stat">
      <span className="pt-stat-label">{label}</span>
      <span className={`pt-stat-value tm-money${tone === 'bad' ? ' tm-bad' : ''}`}>{value}</span>
      {note && <span className="pt-stat-note">{note}</span>}
    </div>
  )
}

/** One series of monthly totals: bars with a hover tooltip and a table for screen readers. */
function MonthlyBars({ months }: { months: { month: string; paid: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 220
  const pad = { top: 16, right: 8, bottom: 28, left: 56 }
  const max = Math.max(1, ...months.map((m) => m.paid))
  const step = niceStep(max / 4)
  const top = step * 4
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom
  const slot = plotW / months.length
  const barW = Math.min(36, slot * 0.5)
  const y = (v: number) => pad.top + plotH - (v / top) * plotH
  const label = (d: string) => new Date(d).toLocaleDateString('en-GB', { month: 'short' })
  const short = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))

  return (
    <figure className="tm-chart">
      <div className="tm-chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Payments received in each of the last 6 months">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={pad.left} x2={W - pad.right} y1={y(i * step)} y2={y(i * step)} className="tm-grid" />
              <text x={pad.left - 8} y={y(i * step)} dy="0.32em" textAnchor="end" className="tm-tick">
                {short(i * step)}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const x = pad.left + slot * i + (slot - barW) / 2
            const h = y(0) - y(m.paid)
            return (
              <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.left + slot * i} y={pad.top} width={slot} height={plotH} fill={hover === i ? 'rgba(47,91,245,0.05)' : 'transparent'} />
                {m.paid > 0 && h >= 4 && <path d={`M${x},${y(0)} v${-(h - 4)} q0,-4 4,-4 h${barW - 8} q4,0 4,4 v${h - 4} z`} fill="#2f5bf5" />}
                <text x={pad.left + slot * i + slot / 2} y={H - 8} textAnchor="middle" className="tm-tick">
                  {label(m.month)}
                </text>
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div className="tm-tip" style={{ left: `${((pad.left + slot * hover + slot / 2) / W) * 100}%` }}>
            <strong>{new Date(months[hover].month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</strong>
            <span>{kes(months[hover].paid)} received</span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Payments received by month</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{label(m.month)}</th>
              <td>{kes(m.paid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw) return m * pow
  return 10 * pow
}
