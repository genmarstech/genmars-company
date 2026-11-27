import type { Milestone, Project } from '../portal/useApi'

export type TeamSummary = {
  total_projects: number
  in_progress: number
  completed: number
  clients: number
  new_clients_this_month: number
  at_risk: number
  new_enquiries: number
  open_orders: number
  unpaid_invoices: number
  unanswered_messages: number
  activity: { date: string; milestones: number; messages: number }[]
  upcoming: { id: number; title: string; due_date: string; project: string; project_id: number; client: string; overdue: boolean }[]
}

export type TeamClient = {
  id: number
  full_name: string
  email: string
  phone_number: string
  company_name: string
  date_joined: string
  project_count: number
  active_projects: number
}

export type TeamMilestone = Milestone & { project: number; order: number }

export type TeamProject = Project & {
  kind: 'client' | 'internal'
  client: number | null
  client_name: string
  /** internal products only: testing is team-only, production is open to people */
  stage: '' | 'testing' | 'production'
  stage_label: string
  app_url: string
  went_live_at: string | null
  milestones: TeamMilestone[]
  links: { id: number; title: string; url: string; created_at: string }[]
}

export type TeamInvoice = {
  id: number
  client: number
  client_name: string
  project: number | null
  project_name: string
  number: string
  description: string
  amount: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  status_label: string
  issued_on: string | null
  due_on: string | null
  paid_on: string | null
  payment_link: string
}

export type Lead = {
  id: number
  full_name: string
  email: string
  phone_number: string
  service: string
  service_label: string
  budget: string
  budget_label: string
  message: string
  status: string
  internal_notes: string
  created_at: string
}

export type Thread = { client: number; client_name: string; last_message: string; last_at: string; needs_reply: boolean }

export type TeamMessage = {
  id: number
  client: number
  project: number | null
  project_name: string
  body: string
  sender_name: string
  from_team: boolean
  read_by_client: boolean
  created_at: string
}

export type Staff = { id: number; full_name: string; email: string; hourly_cost: string | number; has_own_rate: boolean }

export type Task = {
  id: number
  title: string
  notes: string
  project: number | null
  project_name: string
  client: number | null
  client_name: string
  assignee: number | null
  assignee_name: string
  created_by_name: string
  status: 'todo' | 'doing' | 'done'
  status_label: string
  priority: 'low' | 'normal' | 'high'
  due_date: string | null
  completed_at: string | null
  created_at: string
  logged_minutes: number
}

export type TimeEntry = {
  id: number
  project: number
  project_name: string
  client_name: string
  task: number | null
  task_title: string
  user: number
  user_name: string
  date: string
  minutes: number
  note: string
  billable: boolean
}

export type ProjectMoney = {
  value: string | number
  invoiced: string | number
  paid: string | number
  minutes: number
  billable_minutes: number
  cost: string | number
  profit: string | number
  margin: number | null
  budget_used: number | null
}

export type Profitability = {
  projects: (ProjectMoney & { id: number; name: string; client: string; status: string; status_label: string })[]
  totals: { value: string | number; invoiced: string | number; paid: string | number; cost: string | number; profit: string | number; minutes: number; margin: number | null }
  default_hourly_cost: number
  can_edit_rates: boolean
}

export type Today = {
  date: string
  overdue_invoices: { id: number; number: string; client: string; client_id: number; amount: string; due_on: string | null; days: number | null }[]
  overdue_total: string | number
  stalled_leads: { id: number; name: string; service: string; status: string; status_label: string; days: number }[]
  at_risk_projects: { id: number; name: string; client: string; health: string; progress: number; due_date: string | null; reasons: string[] }[]
  my_tasks_due: { id: number; title: string; priority: string; due_date: string; status: string; project: string; project_id: number | null; client: string; overdue: boolean }[]
  my_open_tasks: number
  my_minutes_today: number
  waiting_replies: Thread[]
  waiting_replies_count: number
  orders_waiting: { id: number; number: string; service: string; client: string; status: string; status_label: string; assignee: string; days: number }[]
}

export type ClientNote = { id: number; client: number; body: string; pinned: boolean; author_name: string; is_mine: boolean; created_at: string }

export type ClientOverview = {
  id: number
  full_name: string
  email: string
  phone_number: string
  date_joined: string
  profile: {
    company_name: string
    job_title: string
    industry: string
    company_size: string
    website: string
    contact_method: string
    goals: string
  } | null
  invoiced: string | number
  paid: string | number
  outstanding: string | number
  overdue: string | number
  minutes: number
  projects: { id: number; name: string; status_label: string; health: string; progress: number; due_date: string | null }[]
}

export type ActivityEvent = {
  at: string
  kind: 'account' | 'lead' | 'order' | 'project' | 'milestone' | 'invoice' | 'payment' | 'message' | 'note' | 'task'
  title: string
  detail: string
  link: string
  all_day: boolean
}

export type SearchResult = { kind: 'client' | 'project' | 'invoice' | 'lead' | 'order' | 'task'; id: number; title: string; subtitle: string; url: string }
