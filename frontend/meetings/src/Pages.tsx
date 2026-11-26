import { GooglePanel, History, Insights, MeetingCalendar } from './Meetings'
import { GOOGLE_RESULT, type GoogleStatus, type MeetingsOverview } from './meetingTypes'
import { Layout, Loading } from './ui/Layout'
import { useApi } from './useApi'

export function CalendarPage() {
  return (
    <Layout title="Calendar" subtitle="Every meeting by day. Open one to see its record.">
      <MeetingCalendar />
    </Layout>
  )
}

export function HistoryPage() {
  return (
    <Layout title="Meeting history" subtitle="Search past meetings by title, notes, decisions, action items or people.">
      <History />
    </Layout>
  )
}

export function InsightsPage() {
  const { data, error } = useApi<MeetingsOverview>('/api/v1/meetings/overview/')
  return (
    <Layout title="Analytics" subtitle="Whether meetings lead to records, decisions and finished work.">
      {data ? <Insights o={data} /> : <Loading error={error} />}
    </Layout>
  )
}

export function SettingsPage() {
  const { data, error, reload } = useApi<GoogleStatus>('/api/v1/integrations/google/status/')
  const result = GOOGLE_RESULT[new URLSearchParams(window.location.search).get('google') ?? '']
  return (
    <Layout title="Settings" subtitle="The Google account that creates Meet links and Calendar invites for the team.">
      {result && <p className={`mt-banner mt-banner--${result.tone}`} role="status">{result.text}</p>}
      <div className="mh-narrow">{data ? <GooglePanel status={data} onChange={reload} /> : <Loading error={error} />}</div>
    </Layout>
  )
}
