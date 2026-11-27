import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '../auth/session'

/** Load JSON from the API with the user's token. `reload` fetches again. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    authFetch(path)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Not found.' : 'Couldn’t load this right now.')
        return res.json() as Promise<T>
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setError('')
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Couldn’t reach our servers.')
      })
    return () => {
      cancelled = true
    }
  }, [path, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { data, error, loading: !data && !error, reload }
}

export type Project = {
  id: number
  name: string
  summary: string
  service: string
  status: string
  status_label: string
  health: string
  health_label: string
  progress: number
  budget: string | null
  start_date: string | null
  due_date: string | null
  updated_at: string
}

export type Milestone = {
  id: number
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'done'
  status_label: string
  due_date: string | null
  completed_at: string | null
}

export type ProjectDetail = Project & {
  milestones: Milestone[]
  links: { id: number; title: string; url: string; created_at: string }[]
}

export type Invoice = {
  id: number
  number: string
  description: string
  amount: string
  status: 'sent' | 'paid' | 'overdue'
  status_label: string
  project: number | null
  project_name: string
  issued_on: string | null
  due_on: string | null
  paid_on: string | null
  payment_link: string
}

export type Message = {
  id: number
  project: number | null
  project_name: string
  body: string
  sender_name: string
  from_team: boolean
  created_at: string
}

/** A Genmars product that's in production and open for people to use. */
export type LiveProduct = { id: number; name: string; summary: string; url: string; went_live_at: string | null }

export type Summary = {
  active_projects: number
  completed_projects: number
  invoices: number
  unpaid_total: string | number
  unread_messages: number
  projects: Project[]
  activity: { kind: 'milestone' | 'message'; text: string; project: string; at: string }[]
  open_orders: number
  products: LiveProduct[]
  quotes_waiting: { id: number; number: string; service: string; price: string; valid_until: string | null }[]
}

export function formatDate(value: string | null, withYear = true) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

export function timeAgo(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days < 7 ? `${days}d ago` : formatDate(value, false)
}

export function kes(amount: string | number | null) {
  return amount === null ? '—' : `KES ${Number(amount).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`
}
