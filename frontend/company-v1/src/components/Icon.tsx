import type { IconName } from '../data/site'
import type { ReactNode } from 'react'

const paths: Record<IconName | 'arrow' | 'mail' | 'pin' | 'check' | 'menu' | 'close', ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  code: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2.5l2.2 11h10.6L21 8H6.6" />
      <circle cx="9" cy="19.5" r="1.5" />
      <circle cx="17" cy="19.5" r="1.5" />
    </>
  ),
  flow: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6H15a3 3 0 0 1 3 3v6.5M15.5 18H9a3 3 0 0 1-3-3V8.5" />
    </>
  ),
  link: <path d="M9 15l6-6M10 6.5l1.5-1.5a4.2 4.2 0 0 1 6 6L16 12.5M14 17.5l-1.5 1.5a4.2 4.2 0 0 1-6-6L8 11.5" />,
  cloud: <path d="M7 18h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.3 9.5 4.3 4.3 0 0 0 7 18z" />,
  pen: (
    <>
      <path d="M12 3l7 7-7 11-7-11z" />
      <circle cx="12" cy="10.5" r="2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
}

type Props = {
  name: keyof typeof paths
  size?: number
  strokeWidth?: number
}

export function Icon({ name, size = 18, strokeWidth = 2 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export function LogoMark({ size = 34, label }: { size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width="32" height="32" rx="9" fill="#2F5BF5" />
      <path
        d="M21.66 10.34A8 8 0 1 0 24 16h-8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
