export type IconName =
  | 'code'
  | 'globe'
  | 'cart'
  | 'flow'
  | 'link'
  | 'cloud'
  | 'pen'
  | 'shield'

export type Service = {
  n: string
  slug: string
  /** Matches Enquiry.Service on the backend. */
  apiValue: string
  icon: IconName
  title: string
  short: string
  desc: string
  includes: string[]
  timeline: string
  /** Starting price in KES. Null means quoted per project. */
  from: number | null
  per?: 'month'
}

export const CONTACT_EMAIL = 'info@genmars.co.ke'

export const services: Service[] = [
  {
    n: '01',
    slug: 'custom-software',
    apiValue: 'custom_software',
    icon: 'code',
    title: 'Custom Software Development',
    short: 'Custom software',
    desc: 'Bespoke business systems, web apps, client portals and API integrations (M-Pesa, banks, ERPs, SMS), designed around how your team actually works.',
    includes: ['Web apps, portals & dashboards', 'APIs & M-Pesa integrations', 'Role-based access & reporting', 'Training and handover'],
    timeline: '8–16 weeks',
    from: 150_000,
  },
  {
    n: '02',
    slug: 'websites',
    apiValue: 'website',
    icon: 'globe',
    title: 'Website Design & Development',
    short: 'Website',
    desc: 'Corporate and business websites and landing pages that load fast, look sharp and turn visitors into enquiries.',
    includes: ['Copy & structure', 'Responsive design', 'CMS you can edit', 'SEO & analytics setup'],
    timeline: '2–5 weeks',
    from: 20_000,
  },
  {
    n: '03',
    slug: 'e-commerce',
    apiValue: 'ecommerce',
    icon: 'cart',
    title: 'E-commerce Stores',
    short: 'E-commerce store',
    desc: 'Online shops with M-Pesa and card checkout, stock management and order tracking, so you sell around the clock.',
    includes: ['Product catalogue & stock', 'M-Pesa & card checkout', 'Order & delivery tracking', 'Sales reports'],
    timeline: '4–8 weeks',
    from: 90_000,
  },
  {
    n: '04',
    slug: 'automation',
    apiValue: 'automation',
    icon: 'flow',
    title: 'Business Automation',
    short: 'Business automation',
    desc: 'Digitise repetitive operations, approvals, records and workflows so your team can focus on growth.',
    includes: ['Process mapping', 'Workflow & approvals', 'Document generation', 'Integrations with your tools'],
    timeline: '2–8 weeks',
    from: 25_000,
  },
  {
    n: '05',
    slug: 'ui-ux',
    apiValue: 'ui_ux',
    icon: 'pen',
    title: 'UI/UX Design',
    short: 'UI/UX design',
    desc: 'User research, wireframes, interface design and design systems your developers will love.',
    includes: ['User interviews', 'Wireframes & flows', 'High-fidelity UI', 'Design system'],
    timeline: '2–6 weeks',
    from: 15_000,
  },
  {
    n: '06',
    slug: 'cloud',
    apiValue: 'cloud',
    icon: 'cloud',
    title: 'Cloud Infrastructure & Deployment',
    short: 'Cloud & deployment',
    desc: 'Deployment, server configuration, hosting, backups and monitoring, set up properly the first time.',
    includes: ['Cloud setup & migration', 'CI/CD pipelines', 'Backups & monitoring', 'Security hardening'],
    timeline: '1–3 weeks',
    from: 10_000,
  },
  {
    n: '07',
    slug: 'maintenance',
    apiValue: 'maintenance',
    icon: 'shield',
    title: 'Maintenance & Support',
    short: 'Maintenance & support',
    desc: 'Updates, security patches, backups and small improvements every month, so your system keeps running smoothly.',
    includes: ['Security & software updates', 'Daily backups', 'Uptime monitoring', 'Priority fixes'],
    timeline: 'Ongoing',
    from: 5_000,
    per: 'month',
  },
]

// Values match Enquiry.Budget on the backend.
export const budgetRanges = [
  { value: 'under_50k', label: 'Under KES 50,000' },
  { value: '50k_150k', label: 'KES 50,000 – 150,000' },
  { value: '150k_500k', label: 'KES 150,000 – 500,000' },
  { value: 'over_500k', label: 'KES 500,000+' },
  { value: 'unsure', label: 'Not sure yet' },
]

export const API_URL = import.meta.env.VITE_API_URL ?? ''

export function formatKes(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`
}

export function priceLabel(s: Service) {
  if (s.from === null) return 'Quoted per project'
  return `From ${formatKes(s.from)}${s.per ? ` / ${s.per}` : ''}`
}
