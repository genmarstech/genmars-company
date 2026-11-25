import type { Milestone, Project } from '../portal/useApi'

export type TeamSummary = {
  total_projects: number
  in_progress: number
  completed: number
  clients: number
  new_clients_this_month: number
  at_risk: number
  new_enquiries: number
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
  client: number
  client_name: string
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
