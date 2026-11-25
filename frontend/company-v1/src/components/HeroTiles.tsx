import { Icon } from './Icon'

// Illustrations from the "Website — Home" artboard of the Genmars design canvas.

function ShopArt() {
  return (
    <svg viewBox="0 0 200 140" width="100%" aria-hidden="true">
      <rect x="10" y="124" width="180" height="2" rx="1" fill="#2A3557" />
      <rect x="40" y="50" width="120" height="75" rx="4" fill="#141C33" stroke="#2A3557" />
      {[36, 56, 78, 100, 122, 144].map((x, i) => (
        <rect key={x} x={x} y="40" width={i === 0 || i === 5 ? 20 : 22} height="16" fill={i % 2 ? '#8EA6FF' : '#2F5BF5'} />
      ))}
      {[46, 67, 89, 111, 133, 154].map((cx, i) => (
        <circle key={cx} cx={cx} cy="56" r={i === 0 || i === 5 ? 10 : 11} fill={i % 2 ? '#8EA6FF' : '#2F5BF5'} />
      ))}
      <rect x="50" y="78" width="30" height="26" rx="3" fill="rgba(142,166,255,.22)" stroke="#3A4770" />
      <rect x="120" y="78" width="30" height="26" rx="3" fill="rgba(142,166,255,.22)" stroke="#3A4770" />
      <rect x="88" y="80" width="24" height="45" rx="3" fill="#0B1020" stroke="#3A4770" />
      <rect x="92" y="88" width="16" height="7" rx="2" fill="#5EEAD4" />
      <circle cx="168" cy="30" r="17" fill="#EEF2FA" />
      <path d="M159 24h3l3 11h9l2.5-8H163.5" fill="none" stroke="#2F5BF5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="166" cy="39" r="1.8" fill="#2F5BF5" />
      <circle cx="173" cy="39" r="1.8" fill="#2F5BF5" />
    </svg>
  )
}

function PaymentArt() {
  return (
    <svg viewBox="0 0 200 140" width="100%" aria-hidden="true">
      <ellipse cx="44" cy="120" rx="16" ry="5" fill="#FBBF24" stroke="#B7791F" />
      <ellipse cx="44" cy="112" rx="16" ry="5" fill="#FBBF24" stroke="#B7791F" />
      <ellipse cx="44" cy="104" rx="16" ry="5" fill="#FCD34D" stroke="#B7791F" />
      <rect x="70" y="12" width="60" height="118" rx="11" fill="#141C33" stroke="#3A4770" strokeWidth="1.5" />
      <rect x="76" y="24" width="48" height="94" rx="5" fill="#0B1020" />
      <rect x="92" y="16" width="16" height="3" rx="1.5" fill="#3A4770" />
      <circle cx="100" cy="56" r="17" fill="#5EEAD4" />
      <path d="M92 56.5l5.5 5.5 11-11" fill="none" stroke="#05070D" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="85" y="82" width="30" height="5" rx="2.5" fill="#8EA6FF" />
      <rect x="81" y="93" width="38" height="4" rx="2" fill="#2A3557" />
      <rect x="86" y="102" width="28" height="4" rx="2" fill="#2A3557" />
      <g transform="rotate(-12 162 100)">
        <rect x="140" y="88" width="46" height="26" rx="4" fill="#5EEAD4" />
        <circle cx="163" cy="101" r="7" fill="none" stroke="#05070D" strokeOpacity=".45" strokeWidth="2" />
      </g>
    </svg>
  )
}

function BookingArt() {
  const cells: [number, number, boolean][] = [
    [52, 56, false], [76, 56, true], [100, 56, false], [124, 56, false],
    [52, 76, false], [76, 76, false], [100, 76, true], [124, 76, false],
    [52, 96, true], [76, 96, false], [100, 96, false],
  ]
  return (
    <svg viewBox="0 0 200 140" width="100%" aria-hidden="true">
      <rect x="40" y="24" width="112" height="98" rx="10" fill="#141C33" stroke="#2A3557" />
      <path d="M40 34a10 10 0 0 1 10-10h92a10 10 0 0 1 10 10v12H40z" fill="#2F5BF5" />
      <rect x="66" y="16" width="6" height="16" rx="3" fill="#8EA6FF" />
      <rect x="120" y="16" width="6" height="16" rx="3" fill="#8EA6FF" />
      {cells.map(([x, y, on]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="18" height="14" rx="3" fill={on ? '#2F5BF5' : '#1E2846'} />
      ))}
      <path d="M80.5 63l3 3 6-6M104.5 83l3 3 6-6M56.5 103l3 3 6-6" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="158" cy="108" r="21" fill="#0B1020" stroke="#5EEAD4" strokeWidth="3" />
      <path d="M158 96v12l8 5" fill="none" stroke="#EEF2FA" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

function DeliveryArt() {
  return (
    <svg viewBox="0 0 200 140" width="100%" aria-hidden="true">
      <path d="M8 120C55 100 100 132 192 104" fill="none" stroke="#3A4770" strokeWidth="3" strokeDasharray="7 7" strokeLinecap="round" />
      <path d="M166 18a16 16 0 0 0-16 16c0 12 16 28 16 28s16-16 16-28a16 16 0 0 0-16-16z" fill="#2F5BF5" />
      <circle cx="166" cy="34" r="6" fill="#EEF2FA" />
      <rect x="34" y="62" width="72" height="40" rx="6" fill="#8EA6FF" />
      <rect x="42" y="78" width="56" height="5" rx="2.5" fill="#2F5BF5" />
      <path d="M106 72h20a6 6 0 0 1 5 3l9 13v8a6 6 0 0 1-6 6h-28z" fill="#2F5BF5" />
      <path d="M112 77h13l6 9h-19z" fill="#0B1020" />
      <circle cx="56" cy="104" r="9" fill="#05070D" stroke="#C9D3EA" strokeWidth="3" />
      <circle cx="122" cy="104" r="9" fill="#05070D" stroke="#C9D3EA" strokeWidth="3" />
      <path d="M14 72h12M8 82h14M16 92h8" stroke="#3A4770" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

const tiles = [
  { art: <ShopArt />, title: 'Your shop, online', text: 'Customers order any time, even at 2am.' },
  { art: <PaymentArt />, title: 'Paid instantly', text: 'M-Pesa payments arrive and record themselves.', down: true },
  { art: <BookingArt />, title: 'Bookings sorted', text: 'Clients book online and get SMS reminders.' },
  { art: <DeliveryArt />, title: 'Deliveries tracked', text: 'Know where every order is, live.', down: true },
]

export function HeroTiles() {
  return (
    <div className="hero-visual">
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-tiles">
        {tiles.map((t) => (
          <figure key={t.title} className={`hero-tile${t.down ? ' hero-tile--down' : ''}`}>
            {t.art}
            <figcaption>
              <span className="hero-tile-title">{t.title}</span>
              <span className="hero-tile-text">{t.text}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="hero-toast" aria-hidden="true">
        <span className="hero-toast-icon">
          <Icon name="check" size={18} strokeWidth={2.2} />
        </span>
        <span className="hero-toast-text">
          <span>Payment received</span>
          <span>via M-Pesa · just now</span>
        </span>
      </div>
    </div>
  )
}
