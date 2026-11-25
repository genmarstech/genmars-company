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
    title: 'Custom software',
    short: 'Custom software',
    desc: 'Systems built around how your business already works: stock, sales, payroll and client portals, connected to M-Pesa, your bank and SMS.',
    includes: ['Web apps, portals & dashboards', 'APIs & M-Pesa integrations', 'Role-based access & reporting', 'Training and handover'],
    timeline: '8–16 weeks',
    from: 150_000,
  },
  {
    n: '02',
    slug: 'websites',
    apiValue: 'website',
    icon: 'globe',
    title: 'Websites',
    short: 'Website',
    desc: 'A fast, professional website that tells customers what you do and makes it easy to reach you. You can update it yourself.',
    includes: ['Copy & structure', 'Responsive design', 'CMS you can edit', 'SEO & analytics setup'],
    timeline: '2–5 weeks',
    from: 20_000,
  },
  {
    n: '03',
    slug: 'e-commerce',
    apiValue: 'ecommerce',
    icon: 'cart',
    title: 'Online shops',
    short: 'E-commerce store',
    desc: 'An online shop that takes M-Pesa and card payments, keeps track of stock and tells you about every order.',
    includes: ['Product catalogue & stock', 'M-Pesa & card checkout', 'Order & delivery tracking', 'Sales reports'],
    timeline: '4–8 weeks',
    from: 90_000,
  },
  {
    n: '04',
    slug: 'automation',
    apiValue: 'automation',
    icon: 'flow',
    title: 'Business automation',
    short: 'Business automation',
    desc: 'Replace spreadsheets, paper forms and manual approvals with simple tools that save your team hours every week.',
    includes: ['Process mapping', 'Workflow & approvals', 'Document generation', 'Integrations with your tools'],
    timeline: '2–8 weeks',
    from: 25_000,
  },
  {
    n: '05',
    slug: 'ui-ux',
    apiValue: 'ui_ux',
    icon: 'pen',
    title: 'UI/UX design',
    short: 'UI/UX design',
    desc: 'Clear, easy-to-use screens for your app or website, designed and tested with real users before any code is written.',
    includes: ['User interviews', 'Wireframes & flows', 'High-fidelity UI', 'Design system'],
    timeline: '2–6 weeks',
    from: 15_000,
  },
  {
    n: '06',
    slug: 'cloud',
    apiValue: 'cloud',
    icon: 'cloud',
    title: 'Hosting & deployment',
    short: 'Cloud & deployment',
    desc: 'Hosting, domains, business email, backups and monitoring, set up so your system stays online and secure.',
    includes: ['Cloud setup & migration', 'CI/CD pipelines', 'Backups & monitoring', 'Security hardening'],
    timeline: '1–3 weeks',
    from: 10_000,
  },
  {
    n: '07',
    slug: 'maintenance',
    apiValue: 'maintenance',
    icon: 'shield',
    title: 'Maintenance & support',
    short: 'Maintenance & support',
    desc: 'Monthly updates, backups, security fixes and small changes, with one point of contact when something needs attention.',
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

export function formatKes(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`
}

export function priceLabel(s: Service) {
  if (s.from === null) return 'Quoted per project'
  return `From ${formatKes(s.from)}${s.per ? ` / ${s.per}` : ''}`
}

/*
 * Trust details. Fill these with real information only: every section that
 * uses one of these stays hidden on the site until it has content.
 */
export const company = {
  /** Registered business name, e.g. "Genmars Technologies Ltd". */
  legalName: '',
  /** Business registration number. */
  registrationNo: '',
  /** Office or building, e.g. "4th Floor, Example House, Westlands". */
  address: '',
  city: 'Nairobi, Kenya',
  /** Phone in international format, e.g. "+254712345678". Also used for WhatsApp. */
  phone: '',
  /** e.g. "Monday to Friday, 8am to 6pm". */
  hours: '',
}

export type CaseStudy = {
  client: string
  sector: string
  title: string
  problem: string
  result: string
  service: string
  /** Optional link to the live site or app. */
  url?: string
}
export const caseStudies: CaseStudy[] = []

export type Testimonial = { quote: string; name: string; role: string; company: string }
export const testimonials: Testimonial[] = []

export type TeamMember = { name: string; role: string; bio: string; photo?: string }
export const team: TeamMember[] = []

/** Client names (and logo paths in /public/clients if you have them). */
export const clients: { name: string; logo?: string }[] = []

export function whatsappLink(text = 'Hello Genmars, I would like to talk about a project.') {
  if (!company.phone) return null
  return `https://wa.me/${company.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}
