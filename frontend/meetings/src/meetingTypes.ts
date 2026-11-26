import { ApiError, postJson } from './session'
import { useApi } from './useApi'

export type MeetingStatus = 'planned' | 'live' | 'completed' | 'cancelled' | 'failed'
export type ReportStatus = 'draft' | 'review' | 'approved'

export type MeetingRow = {
  id: number
  title: string
  kind: 'instant' | 'scheduled'
  category: string
  category_label: string
  status: MeetingStatus
  status_label: string
  organizer: number | null
  organizer_name: string
  project: number | null
  project_name: string
  client_name: string
  scheduled_start: string
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  duration_minutes: number | null
  meet_uri: string
  conference_status: 'none' | 'pending' | 'ready' | 'failed'
  report_status: ReportStatus
  report_label: string
  participant_count: number
  open_actions: number
  decision_count: number
  has_transcript: boolean
}

export type Participant = {
  id: number
  user: number | null
  email: string
  name: string
  role: 'organizer' | 'cohost' | 'attendee' | 'guest'
  role_label: string
  response: 'needsAction' | 'accepted' | 'tentative' | 'declined'
  response_label: string
  is_guest: boolean
  attended: boolean
  joined_at: string | null
  left_at: string | null
}

export type AgendaItem = { id: number; title: string; notes: string; minutes: number | null; covered: boolean; position: number }

export type MeetingNote = { id: number; body: string; author: number | null; author_name: string; created_at: string; updated_at: string }

export type PointKind = 'discussion' | 'problem' | 'solution' | 'decision'

export type Point = {
  id: number
  kind: PointKind
  kind_label: string
  title: string
  detail: string
  status: 'noted' | 'open' | 'resolved' | 'proposed' | 'accepted' | 'rejected' | 'approved'
  status_label: string
  problem: number | null
  owner: number | null
  owner_name: string
  approved_by_name: string
  approved_at: string | null
  created_at: string
}

export type ActionItem = {
  id: number
  meeting: number
  meeting_title: string
  decision: number | null
  title: string
  notes: string
  assignee: number | null
  assignee_name: string
  due_date: string | null
  priority: 'low' | 'normal' | 'high'
  status: 'todo' | 'doing' | 'done'
  task: number | null
  task_status: string | null
  created_at: string
}

export type Artifact = { id: number; kind: 'transcript' | 'recording' | 'smart_notes'; kind_label: string; state: string; link: string; content: string; created_at: string }

export type MeetingDetail = MeetingRow & {
  description: string
  time_zone: string
  meeting_code: string
  calendar_link: string
  conference_label: string
  google_error: string
  last_synced_at: string | null
  sync_done: boolean
  summary: string
  report_approved_by_name: string
  report_approved_at: string | null
  participants: Participant[]
  agenda: AgendaItem[]
  notes: MeetingNote[]
  points: Point[]
  actions: ActionItem[]
  artifacts: Artifact[]
  activity: { id: number; text: string; actor: string; at: string }[]
  can_approve: boolean
  created_at: string
}

export type GoogleStatus = {
  configured: boolean
  connected: boolean
  status: 'connected' | 'expired' | 'disconnected'
  status_label: string
  account_email: string
  connected_by: string
  connected_at: string | null
  scopes: string[]
  last_error: string
  can_manage: boolean
}

export type MeetingsOverview = {
  upcoming_count: number
  this_month: number
  completed: number
  records_approved: number
  needs_review: number
  open_actions: number
  insights: {
    minutes_this_month: number
    record_rate: number | null
    transcript_rate: number | null
    actions_this_month: number
    actions_done_this_month: number
    linked_to_projects: number
  }
  upcoming: MeetingRow[]
  my_actions: ActionItem[]
  google: GoogleStatus
}

export const CATEGORIES = [
  { value: 'internal', label: 'Internal' },
  { value: 'client', label: 'Client' },
  { value: 'project', label: 'Project' },
  { value: 'standup', label: 'Stand-up' },
  { value: 'sales', label: 'Sales' },
  { value: 'other', label: 'Other' },
]

export const statusTone: Record<MeetingStatus, string> = {
  planned: 'blue',
  live: 'green',
  completed: 'gray',
  cancelled: 'red',
  failed: 'red',
}

export const reportTone: Record<ReportStatus, string> = { draft: 'gray', review: 'amber', approved: 'green' }

/** "14:30" in the viewer's time. */
export function clock(value: string | null) {
  return value ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
}

/** "Today", "Tomorrow" or "Thu 27 Nov". */
export function dayLabel(value: string) {
  const d = new Date(value)
  const today = new Date()
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}

export function timeRange(m: Pick<MeetingRow, 'scheduled_start' | 'scheduled_end' | 'actual_start' | 'actual_end' | 'status'>) {
  const start = m.status === 'completed' && m.actual_start ? m.actual_start : m.scheduled_start
  const end = m.status === 'completed' && m.actual_end ? m.actual_end : m.scheduled_end
  return end ? `${clock(start)}–${clock(end)}` : clock(start)
}

/** Joinable from 15 minutes before the start until it ends. */
export function canJoin(m: MeetingRow) {
  if (!m.meet_uri || m.status === 'cancelled' || m.status === 'completed') return false
  return m.status === 'live' || new Date(m.scheduled_start).getTime() - Date.now() < 15 * 60_000
}

/** A <input type="datetime-local"> value for an ISO time, in the viewer's zone. */
export function toLocalInput(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const viewerZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi'

/** Open the Meet tab straight away (inside the click, so it isn't blocked), then point it at the link.
 * Returns an error message, or null when the call opened. */
export async function joinMeeting(id: number): Promise<string | null> {
  const tab = window.open('', '_blank')
  try {
    const { meet_uri } = await postJson<{ meet_uri: string }>(`/api/v1/meetings/${id}/join/`, {})
    if (tab) tab.location.href = meet_uri
    else window.location.href = meet_uri
    return null
  } catch (e) {
    tab?.close()
    return e instanceof ApiError && e.message ? e.message : 'Couldn’t open the meeting.'
  }
}

export type Staff = { id: number; full_name: string; email: string }
export type ProjectRef = { id: number; name: string; client_name: string }
export type Directory = { me: Staff & { is_owner: boolean }; staff: Staff[]; projects: ProjectRef[] }

/** The team and open projects from the company database. */
export function useDirectory() {
  return useApi<Directory>('/api/v1/meetings/directory/').data
}

/** The team dashboard on the main site, for projects and the task list. */
export const TEAM_URL = (import.meta.env.VITE_TEAM_URL || 'https://company-v1-gamma.vercel.app').replace(/\/+$/, '')
