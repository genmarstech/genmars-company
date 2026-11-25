import { useEffect, useState, type ReactNode } from 'react'
import './HeroFlow.css'

/*
 * A small "how it connects" diagram: an order comes in, gets paid, runs through
 * the system Genmars builds, and lands on the owner's dashboard. Drawn as plain SVG
 * so it stays crisp at any size; a quiet dot travels along each line.
 */

type Tone = 'blue' | 'green' | 'amber' | 'ice'
type Node = { id: string; x: number; y: number; w?: number; title: string; sub: string; icon: keyof typeof icons; tone: Tone; hub?: boolean }
type Edge = [string, string]

const W = 172
const H = 54

const icons = {
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></>,
  cart: <><path d="M3 4h2.5l2.2 11h10.6L21 8H6.6" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18h2" /></>,
  card: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  box: <><path d="M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5z" /><path d="M3 7.5l9 4.5 9-4.5M12 12v9" /></>,
  doc: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
}

// Wide layout: left to right
const wideNodes: Node[] = [
  { id: 'shop', x: 16, y: 54, title: 'New order', sub: 'Online shop', icon: 'cart', tone: 'ice' },
  { id: 'site', x: 16, y: 178, title: 'Booking made', sub: 'Website', icon: 'calendar', tone: 'ice' },
  { id: 'mpesa', x: 242, y: 54, title: 'M-Pesa payment', sub: 'KES 4,500 received', icon: 'phone', tone: 'green' },
  { id: 'cardpay', x: 242, y: 178, title: 'Card payment', sub: 'Confirmed', icon: 'card', tone: 'green' },
  { id: 'hub', x: 460, y: 116, w: 200, title: 'Your Genmars system', sub: 'Runs it all, automatically', icon: 'globe', tone: 'blue', hub: true },
  { id: 'stock', x: 704, y: 24, title: 'Stock updated', sub: '12 left in store', icon: 'box', tone: 'amber' },
  { id: 'invoice', x: 704, y: 116, title: 'Invoice sent', sub: 'KRA eTIMS ready', icon: 'doc', tone: 'amber' },
  { id: 'sms', x: 704, y: 208, title: 'SMS to customer', sub: 'Order on its way', icon: 'chat', tone: 'amber' },
  { id: 'dash', x: 932, y: 70, title: 'Owner dashboard', sub: 'Sales today: KES 86,200', icon: 'chart', tone: 'blue' },
  { id: 'portal', x: 932, y: 162, title: 'Client portal', sub: 'Order tracked live', icon: 'user', tone: 'blue' },
]
const wideEdges: Edge[] = [
  ['shop', 'mpesa'], ['site', 'cardpay'], ['mpesa', 'hub'], ['cardpay', 'hub'],
  ['hub', 'stock'], ['hub', 'invoice'], ['hub', 'sms'],
  ['stock', 'dash'], ['invoice', 'dash'], ['invoice', 'portal'], ['sms', 'portal'],
]

// Phone layout: top to bottom
const tallNodes: Node[] = [
  { id: 'shop', x: 74, y: 8, title: 'New order', sub: 'Online shop', icon: 'cart', tone: 'ice' },
  { id: 'mpesa', x: 74, y: 104, title: 'M-Pesa payment', sub: 'KES 4,500 received', icon: 'phone', tone: 'green' },
  { id: 'hub', x: 60, y: 200, w: 200, title: 'Your Genmars system', sub: 'Runs it all, automatically', icon: 'globe', tone: 'blue', hub: true },
  { id: 'invoice', x: 8, y: 306, w: 148, title: 'Invoice sent', sub: 'eTIMS ready', icon: 'doc', tone: 'amber' },
  { id: 'sms', x: 164, y: 306, w: 148, title: 'SMS sent', sub: 'To customer', icon: 'chat', tone: 'amber' },
  { id: 'dash', x: 74, y: 412, title: 'Owner dashboard', sub: 'Sales today: KES 86,200', icon: 'chart', tone: 'blue' },
]
const tallEdges: Edge[] = [['shop', 'mpesa'], ['mpesa', 'hub'], ['hub', 'invoice'], ['hub', 'sms'], ['invoice', 'dash'], ['sms', 'dash']]

function edgePath(a: Node, b: Node, vertical: boolean) {
  const aw = a.w ?? W
  const bw = b.w ?? W
  if (vertical) {
    const x1 = a.x + aw / 2, y1 = a.y + H, x2 = b.x + bw / 2, y2 = b.y
    const my = (y1 + y2) / 2
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`
  }
  const x1 = a.x + aw, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2
  const mx = (x1 + x2) / 2
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
}

function NodeBox({ n, vertical }: { n: Node; vertical: boolean }) {
  const w = n.w ?? W
  return (
    <g className={`hf-node hf-${n.tone}${n.hub ? ' hf-hub' : ''}`} transform={`translate(${n.x} ${n.y})`}>
      <rect className="hf-card" width={w} height={H} rx="12" />
      <rect className="hf-icon-bg" x="10" y="12" width="30" height="30" rx="8" />
      {n.hub ? (
        <path d="M21.66 10.34A8 8 0 1 0 24 16h-8" transform="translate(13 15) scale(0.75)" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <svg x="17" y="19" width="16" height="16" viewBox="0 0 24 24" className="hf-icon">
          {icons[n.icon] as ReactNode}
        </svg>
      )}
      <text x="50" y="24" className="hf-title">
        {n.title}
      </text>
      <text x="50" y="40" className="hf-sub">
        {n.sub}
      </text>
      {/* connection ports */}
      {vertical ? (
        <>
          <circle className="hf-port" cx={w / 2} cy="0" r="2.5" />
          <circle className="hf-port" cx={w / 2} cy={H} r="2.5" />
        </>
      ) : (
        <>
          <circle className="hf-port" cx="0" cy={H / 2} r="2.5" />
          <circle className="hf-port" cx={w} cy={H / 2} r="2.5" />
        </>
      )}
    </g>
  )
}

function Diagram({ nodes, edges, vertical, width, height, motion }: {
  nodes: Node[]
  edges: Edge[]
  vertical: boolean
  width: number
  height: number
  motion: boolean
}) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const cycle = vertical ? 'hf-cycle-tall' : 'hf-cycle-wide'
  // signals leave each column a beat after the previous one, so the flow reads in order
  const order = (id: string) => [...new Set(nodes.map((n) => (vertical ? n.y : n.x)))].sort((a, b) => a - b).indexOf(vertical ? byId[id].y : byId[id].x)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`hf-svg ${vertical ? 'hf-tall' : 'hf-wide'}`} aria-hidden="true">
      {edges.map(([a, b]) => {
        const d = edgePath(byId[a], byId[b], vertical)
        return (
          <g key={`${a}-${b}`}>
            <path d={d} className="hf-line" />
            {motion && (
              <circle r="2.6" className="hf-signal">
                <animateMotion dur="1.6s" begin={`${order(a) * 0.8}s;${cycle}.end+${order(a) * 0.8}s`} path={d} fill="freeze" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="1.6s" begin={`${order(a) * 0.8}s;${cycle}.end+${order(a) * 0.8}s`} fill="freeze" />
              </circle>
            )}
          </g>
        )
      })}
      {/* a silent timer that restarts every signal together, so the flow repeats as one wave */}
      {motion && (
        <rect width="0" height="0">
          <animate id={cycle} attributeName="x" from="0" to="0" begin={`0s;${cycle}.end`} dur="5.2s" />
        </rect>
      )}
      {nodes.map((n) => (
        <NodeBox key={n.id} n={n} vertical={vertical} />
      ))}
    </svg>
  )
}

export function HeroFlow() {
  const [motion, setMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setMotion(!mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return (
    <figure className="hf" role="img" aria-label="How a Genmars system connects your business: an online order or booking is paid by M-Pesa or card, your Genmars system updates stock, sends the invoice and an SMS, and everything shows up on your dashboard and client portal.">
      <Diagram nodes={wideNodes} edges={wideEdges} vertical={false} width={1120} height={286} motion={motion} />
      <Diagram nodes={tallNodes} edges={tallEdges} vertical width={320} height={474} motion={motion} />
      <figcaption className="hf-caption">How a Genmars system connects your business</figcaption>
    </figure>
  )
}
