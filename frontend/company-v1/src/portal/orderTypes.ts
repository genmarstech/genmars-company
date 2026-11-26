/** Shapes of the order API, shared by the client portal and the team dashboard. */

export type CatalogueService = {
  id: number
  key: string
  slug: string
  name: string
  summary: string
  includes: string[]
  timeline: string
  starting_price: string
  billing: 'once' | 'monthly'
  billing_label: string
  deposit_percent: number
  is_active: boolean
  order: number
}

export type OrderStatus =
  | 'submitted'
  | 'reviewing'
  | 'quoted'
  | 'accepted'
  | 'in_progress'
  | 'delivered'
  | 'completed'
  | 'declined'
  | 'cancelled'

export type OrderUpdate = {
  id: number
  kind: 'status' | 'quote' | 'comment'
  status: string
  status_label: string
  body: string
  internal: boolean
  author_name: string
  from_team: boolean
  created_at: string
}

export type Order = {
  id: number
  number: string
  service: string
  service_slug: string
  service_name: string
  starting_price: string
  billing: 'once' | 'monthly'
  billing_label: string
  brief: string
  links: string
  budget: string | null
  wanted_by: string | null
  status: OrderStatus
  status_label: string
  quoted_price: string | null
  quote_note: string
  quote_valid_until: string | null
  quoted_at: string | null
  quote_expired: boolean
  deposit: string | null
  accepted_at: string | null
  closed_at: string | null
  project: number | null
  can_cancel: boolean
  created_at: string
  updated_at: string
}

export type OrderDetail = Order & { updates: OrderUpdate[] }

export const orderTone: Record<OrderStatus, string> = {
  submitted: 'blue',
  reviewing: 'blue',
  quoted: 'amber',
  accepted: 'green',
  in_progress: 'blue',
  delivered: 'green',
  completed: 'green',
  declined: 'gray',
  cancelled: 'gray',
}

export const perMonth = (o: { billing: string }) => (o.billing === 'monthly' ? ' / month' : '')
