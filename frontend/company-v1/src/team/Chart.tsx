import { useState } from 'react'

type Day = { date: string; milestones: number; messages: number }

const SERIES = [
  { key: 'milestones', label: 'Milestones completed', color: '#2f5bf5' },
  { key: 'messages', label: 'Client messages', color: '#eb6834' },
] as const

/** Grouped bars for the last 7 days, with a legend, hover tooltip and a table for screen readers. */
export function ActivityChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 220
  const pad = { top: 16, right: 8, bottom: 28, left: 28 }
  const max = Math.max(4, ...days.flatMap((d) => [d.milestones, d.messages]))
  const step = Math.ceil(max / 4)
  const top = step * 4
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom
  const slot = plotW / days.length
  const barW = Math.min(18, slot / 3)
  const y = (v: number) => pad.top + plotH - (v / top) * plotH
  const label = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short' })

  return (
    <figure className="tm-chart">
      <ul className="tm-legend">
        {SERIES.map((s) => (
          <li key={s.key}>
            <span style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="tm-chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Milestones completed and client messages for each of the last 7 days">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={pad.left} x2={W - pad.right} y1={y(i * step)} y2={y(i * step)} className="tm-grid" />
              <text x={pad.left - 8} y={y(i * step)} dy="0.32em" textAnchor="end" className="tm-tick">
                {i * step}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = pad.left + slot * i + slot / 2
            return (
              <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.left + slot * i} y={pad.top} width={slot} height={plotH} fill={hover === i ? 'rgba(47,91,245,0.05)' : 'transparent'} />
                {SERIES.map((s, j) => {
                  const v = d[s.key]
                  const x = cx - barW - 1 + j * (barW + 2)
                  const h = Math.max(0, y(0) - y(v))
                  return v > 0 ? (
                    <path
                      key={s.key}
                      d={`M${x},${y(0)} v${-(h - 4)} q0,-4 4,-4 h${barW - 8} q4,0 4,4 v${h - 4} z`}
                      fill={s.color}
                    />
                  ) : null
                })}
                <text x={cx} y={H - 8} textAnchor="middle" className="tm-tick">
                  {label(d.date)}
                </text>
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div className="tm-tip" style={{ left: `${((pad.left + slot * hover + slot / 2) / W) * 100}%` }}>
            <strong>{new Date(days[hover].date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</strong>
            {SERIES.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} aria-hidden="true" />
                {s.label}: {days[hover][s.key]}
              </span>
            ))}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Activity for the last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {SERIES.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{label(d.date)}</th>
              <td>{d.milestones}</td>
              <td>{d.messages}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
