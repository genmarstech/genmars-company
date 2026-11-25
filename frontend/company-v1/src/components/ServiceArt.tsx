import type { ReactNode } from 'react'

// Small product-style illustrations for each service, drawn in the brand palette.
const C = {
  panel: '#0F1628',
  line: '#2A3557',
  soft: '#1E2846',
  cobalt: '#2F5BF5',
  ice: '#8EA6FF',
  signal: '#5EEAD4',
  amber: '#FBBF24',
  frost: '#EEF2FA',
}

function Window({ children }: { children: ReactNode }) {
  return (
    <>
      <rect x="20" y="16" width="200" height="124" rx="10" fill={C.panel} stroke={C.line} />
      <path d="M20 26a10 10 0 0 1 10-10h180a10 10 0 0 1 10 10v8H20z" fill={C.soft} />
      <circle cx="32" cy="25" r="2.5" fill={C.line} />
      <circle cx="41" cy="25" r="2.5" fill={C.line} />
      <circle cx="50" cy="25" r="2.5" fill={C.line} />
      {children}
    </>
  )
}

const art: Record<string, ReactNode> = {
  // Dashboard with sidebar, stats and a chart
  'custom-software': (
    <Window>
      <rect x="20" y="34" width="44" height="106" fill="#0B1020" />
      {[46, 58, 70, 82].map((y, i) => (
        <rect key={y} x="28" y={y} width={i === 0 ? 28 : 22} height="5" rx="2.5" fill={i === 0 ? C.ice : C.line} />
      ))}
      <rect x="74" y="44" width="40" height="24" rx="5" fill={C.soft} />
      <rect x="120" y="44" width="40" height="24" rx="5" fill={C.soft} />
      <rect x="166" y="44" width="44" height="24" rx="5" fill={C.soft} />
      <rect x="80" y="50" width="16" height="4" rx="2" fill={C.line} />
      <rect x="80" y="58" width="24" height="5" rx="2.5" fill={C.frost} />
      <rect x="126" y="50" width="16" height="4" rx="2" fill={C.line} />
      <rect x="126" y="58" width="22" height="5" rx="2.5" fill={C.signal} />
      <rect x="172" y="50" width="16" height="4" rx="2" fill={C.line} />
      <rect x="172" y="58" width="26" height="5" rx="2.5" fill={C.ice} />
      <rect x="74" y="76" width="136" height="54" rx="6" fill={C.soft} />
      <path d="M82 120l18-14 16 8 20-22 18 10 22-18 26 8" fill="none" stroke={C.cobalt} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Window>
  ),
  // Business website with nav, headline and image
  websites: (
    <Window>
      <rect x="32" y="42" width="22" height="5" rx="2.5" fill={C.frost} />
      <rect x="150" y="42" width="14" height="4" rx="2" fill={C.line} />
      <rect x="168" y="42" width="14" height="4" rx="2" fill={C.line} />
      <rect x="186" y="40" width="24" height="9" rx="4.5" fill={C.cobalt} />
      <rect x="32" y="64" width="78" height="8" rx="4" fill={C.frost} />
      <rect x="32" y="77" width="62" height="8" rx="4" fill={C.frost} />
      <rect x="32" y="92" width="70" height="4" rx="2" fill={C.line} />
      <rect x="32" y="100" width="56" height="4" rx="2" fill={C.line} />
      <rect x="32" y="114" width="36" height="12" rx="6" fill={C.cobalt} />
      <rect x="122" y="60" width="88" height="68" rx="6" fill={C.soft} />
      <path d="M122 116l24-22 18 14 14-10 32 22v2a6 6 0 0 1-6 6h-76a6 6 0 0 1-6-6z" fill="#2A3B78" />
      <circle cx="190" cy="76" r="7" fill={C.amber} />
    </Window>
  ),
  // Product grid with M-Pesa checkout
  'e-commerce': (
    <Window>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={30 + i * 46} y="44" width="40" height="40" rx="6" fill={C.soft} />
          <rect x={38 + i * 46} y="52" width="24" height="24" rx="4" fill={[C.ice, C.cobalt, '#3A4770'][i]} />
          <rect x={30 + i * 46} y="90" width="30" height="4" rx="2" fill={C.line} />
          <rect x={30 + i * 46} y="98" width="20" height="5" rx="2.5" fill={C.frost} />
        </g>
      ))}
      <rect x="168" y="44" width="44" height="86" rx="7" fill="#0B1020" stroke={C.line} />
      <circle cx="190" cy="70" r="12" fill={C.signal} />
      <path d="M184 70.5l4 4 8-8" fill="none" stroke="#05070D" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="176" y="92" width="28" height="4" rx="2" fill={C.line} />
      <rect x="178" y="112" width="24" height="10" rx="5" fill={C.signal} />
      <rect x="30" y="114" width="40" height="12" rx="6" fill={C.cobalt} />
    </Window>
  ),
  // Workflow: form to approval to done
  automation: (
    <>
      <rect x="18" y="48" width="58" height="60" rx="9" fill={C.panel} stroke={C.line} />
      <rect x="28" y="60" width="38" height="5" rx="2.5" fill={C.frost} />
      <rect x="28" y="72" width="30" height="4" rx="2" fill={C.line} />
      <rect x="28" y="81" width="34" height="4" rx="2" fill={C.line} />
      <rect x="28" y="92" width="20" height="8" rx="4" fill={C.cobalt} />
      <path d="M78 78h18" stroke={C.ice} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 5" />
      <rect x="96" y="56" width="48" height="44" rx="22" fill={C.panel} stroke={C.ice} strokeWidth="1.5" />
      <path d="M110 78l7 7 13-14" fill="none" stroke={C.ice} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M146 78h18" stroke={C.ice} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 5" />
      <rect x="164" y="48" width="58" height="60" rx="9" fill={C.panel} stroke={C.line} />
      <rect x="174" y="60" width="38" height="5" rx="2.5" fill={C.frost} />
      <rect x="174" y="74" width="26" height="9" rx="4.5" fill="rgba(94,234,212,.18)" />
      <rect x="178" y="77" width="18" height="3" rx="1.5" fill={C.signal} />
      <rect x="174" y="90" width="34" height="4" rx="2" fill={C.line} />
      <path d="M40 126h160" stroke={C.line} strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="126" r="4" fill={C.cobalt} />
      <circle cx="120" cy="126" r="4" fill={C.ice} />
      <circle cx="200" cy="126" r="4" fill={C.signal} />
    </>
  ),
  // Phone wireframe beside a finished screen
  'ui-ux': (
    <>
      <rect x="44" y="18" width="70" height="120" rx="12" fill="none" stroke={C.line} strokeDasharray="4 4" />
      <rect x="54" y="34" width="50" height="26" rx="4" fill="none" stroke={C.line} />
      <path d="M54 34l50 26M104 34l-50 26" stroke={C.line} />
      <rect x="54" y="68" width="40" height="4" rx="2" fill={C.line} />
      <rect x="54" y="78" width="50" height="4" rx="2" fill={C.line} />
      <rect x="54" y="118" width="50" height="10" rx="5" fill="none" stroke={C.line} />
      <rect x="126" y="18" width="70" height="120" rx="12" fill={C.panel} stroke={C.line} />
      <rect x="136" y="34" width="50" height="26" rx="5" fill={C.cobalt} />
      <circle cx="150" cy="47" r="6" fill={C.ice} />
      <rect x="136" y="68" width="38" height="5" rx="2.5" fill={C.frost} />
      <rect x="136" y="79" width="50" height="4" rx="2" fill={C.line} />
      <rect x="136" y="88" width="44" height="4" rx="2" fill={C.line} />
      <rect x="136" y="118" width="50" height="10" rx="5" fill={C.cobalt} />
      <path d="M114 78h12" stroke={C.ice} strokeWidth="2" strokeLinecap="round" />
      <path d="M121 73l5 5-5 5" fill="none" stroke={C.ice} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Servers with status lights and a cloud
  cloud: (
    <>
      <path d="M150 58h34a18 18 0 0 0 2-35.9A26 26 0 0 0 136 30a18 18 0 0 0 14 28z" fill={C.soft} stroke={C.line} />
      {[68, 96, 124].map((y, i) => (
        <g key={y}>
          <rect x="50" y={y} width="140" height="22" rx="6" fill={C.panel} stroke={C.line} />
          <circle cx="64" cy={y + 11} r="4" fill={i === 1 ? C.amber : C.signal} />
          <rect x="76" y={y + 9} width="40" height="4" rx="2" fill={C.line} />
          <rect x="150" y={y + 7} width="4" height="8" rx="2" fill={C.line} />
          <rect x="158" y={y + 7} width="4" height="8" rx="2" fill={C.line} />
          <rect x="166" y={y + 7} width="4" height="8" rx="2" fill={C.line} />
        </g>
      ))}
      <path d="M160 58v10" stroke={C.ice} strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
    </>
  ),
  // Uptime chart and checklist
  maintenance: (
    <Window>
      <rect x="32" y="44" width="40" height="5" rx="2.5" fill={C.frost} />
      <rect x="168" y="42" width="42" height="9" rx="4.5" fill="rgba(94,234,212,.15)" />
      <rect x="174" y="45" width="30" height="3" rx="1.5" fill={C.signal} />
      {Array.from({ length: 22 }, (_, i) => (
        <rect key={i} x={32 + i * 8} y="60" width="5" height="18" rx="2" fill={i === 13 ? C.amber : C.signal} opacity={i === 13 ? 1 : 0.75} />
      ))}
      {[90, 104, 118].map((y, i) => (
        <g key={y}>
          <rect x="32" y={y} width="10" height="10" rx="3" fill={i < 2 ? C.cobalt : 'none'} stroke={i < 2 ? 'none' : C.line} />
          {i < 2 && <path d={`M34.5 ${y + 5}l2 2 3.5-4`} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
          <rect x="50" y={y + 3} width={[70, 56, 64][i]} height="4" rx="2" fill={C.line} />
        </g>
      ))}
    </Window>
  ),
}

export function ServiceArt({ slug }: { slug: string }) {
  return (
    <svg viewBox="0 0 240 156" width="100%" aria-hidden="true">
      {art[slug]}
    </svg>
  )
}
