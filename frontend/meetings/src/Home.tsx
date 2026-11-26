import { useMemo, useState } from 'react'
import { MyActions, ScheduleForm } from './Meetings'
import {
  GOOGLE_RESULT, canJoin, clock, joinMeeting, timeRange,
  type MeetingDetail, type MeetingRow, type MeetingsOverview,
} from './meetingTypes'
import { navigate } from './router'
import { ApiError, postJson } from './session'
import { hm, isoDate } from './shared'
import { Icon, MeetTile, type IconName } from './ui/Icon'
import { Empty, Layout, Loading, Panel } from './ui/Layout'
import { Link } from './ui/Link'
import { useApi } from './useApi'

// The tile beside each meeting, by type
const KIND_ICON: Record<string, { icon: IconName; tone: string }> = {
  project: { icon: 'code', tone: 'blue' },
  client: { icon: 'briefcase', tone: 'blue' },
  sales: { icon: 'chart', tone: 'purple' },
  standup: { icon: 'users', tone: 'green' },
  internal: { icon: 'users', tone: 'green' },
  other: { icon: 'bulb', tone: 'amber' },
}

export function Home() {
  const params = new URLSearchParams(window.location.search)
  const [scheduling, setScheduling] = useState(params.get('new') === '1')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const overview = useApi<MeetingsOverview>('/api/v1/meetings/overview/')
  const o = overview.data
  const googleResult = GOOGLE_RESULT[params.get('google') ?? '']

  const startInstant = async () => {
    setStarting(true)
    setError('')
    const tab = window.open('', '_blank')
    try {
      const m = await postJson<MeetingDetail>('/api/v1/meetings/instant/', {})
      if (tab) tab.location.href = m.meet_uri
      navigate(`/${m.id}`)
    } catch (e) {
      tab?.close()
      setError(e instanceof ApiError && e.message ? e.message : 'Couldn’t start the meeting.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <Layout>
      <section className="mh-hero">
        <div>
          <span className="mh-chip">
            <Icon name="users" size={16} strokeWidth={1.9} /> Teams Hub
          </span>
          <h1>
            Genmars <span>Meetings</span>
          </h1>
          <p>Plan, host and keep track of all company meetings. Powered by Google Meet.</p>
          <div className="mh-cta">
            <button type="button" className="btn" disabled={starting || !o?.google.connected} title={o && !o.google.connected ? 'Connect Google first' : undefined} onClick={startInstant}>
              <Icon name="video" size={18} /> {starting ? 'Starting…' : 'Start Instant Meeting'} <Icon name="arrow" size={16} />
            </button>
            <button type="button" className="btn btn--ghost mh-ghost" onClick={() => setScheduling((s) => !s)}>
              <Icon name="calendar" size={18} /> {scheduling ? 'Close' : 'Schedule Meeting'} <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>
        {o && (
          <Link to="/settings" className={`mh-badge${o.google.connected ? '' : ' is-off'}`}>
            <MeetTile size={38} />
            <span>
              Google Meet
              <small>{o.google.connected ? 'Integrated' : 'Not connected'}</small>
            </span>
            <span className="mh-badge-tick">
              <Icon name={o.google.connected ? 'check' : 'arrow'} size={14} strokeWidth={2.6} />
            </span>
          </Link>
        )}
      </section>

      {googleResult && <p className={`mt-banner mt-banner--${googleResult.tone}`} role="status">{googleResult.text}</p>}
      {error && <p className="pt-error">{error}</p>}

      {scheduling && (
        <Panel title="Schedule a meeting">
          <ScheduleForm google={o?.google} onSaved={(m) => navigate(`/${m.id}`)} onCancel={() => setScheduling(false)} />
        </Panel>
      )}

      {!o ? (
        <Loading error={overview.error} />
      ) : (
        <>
          <div className="mh-stats">
            <StatCard tone="blue" icon="calendar" value={o.upcoming_count} label="Upcoming Meetings" note={`${o.upcoming_this_week} in the next 7 days`} series={o.trends.upcoming} />
            <StatCard
              tone="purple"
              icon="checkCircle"
              value={o.this_month}
              label="This Month"
              note={o.this_month_change === null ? 'First month on record' : `${o.this_month_change >= 0 ? '+' : ''}${o.this_month_change}% vs last month`}
              up={o.this_month_change === null || o.this_month_change >= 0}
              series={o.trends.held}
            />
            <StatCard tone="green" icon="check" value={o.completed} label="Completed" note={`+${o.completed_this_week} this week`} series={o.trends.completed} />
            <StatCard
              tone="amber"
              icon="file"
              value={o.records_approved}
              label="Meeting Records"
              note={o.needs_review ? `${o.needs_review} waiting for review` : `+${o.records_this_week} approved this week`}
              series={o.trends.records}
            />
          </div>

          <div className="mh-grid">
            <div className="mh-col">
              <section className="pt-panel mh-upcoming">
                <div className="mh-panel-head">
                  <span className="mh-panel-icon">
                    <Icon name="video" size={20} />
                  </span>
                  <div>
                    <h2>Upcoming Meetings</h2>
                    <p>Your next meetings and scheduled calls</p>
                  </div>
                  <Link to="/calendar" className="btn btn--sm btn--ghost mh-push">
                    <Icon name="calendar" size={16} /> View Calendar <Icon name="arrow" size={14} />
                  </Link>
                </div>
                <UpcomingList meetings={o.upcoming} />
              </section>

              <section className="mh-banner">
                <MeetTile size={56} />
                <div>
                  <strong>Bring your team together with Google Meet</strong>
                  <span>Create meetings, share links and keep every meeting record in one place.</span>
                </div>
                <ul>
                  <li><Icon name="check" size={14} strokeWidth={2.6} /> Instant & scheduled meetings</li>
                  <li><Icon name="check" size={14} strokeWidth={2.6} /> Decisions & records</li>
                  <li><Icon name="check" size={14} strokeWidth={2.6} /> Action items & more</li>
                </ul>
              </section>

              <Panel title="Your action items" action={<span className="pt-muted pt-small">{o.open_actions} open across the team</span>}>
                <MyActions items={o.my_actions} onChange={overview.reload} />
              </Panel>
            </div>

            <div className="mh-col">
              <section className="pt-panel">
                <MiniCalendar />
                <div className={`mh-connect${o.google.connected ? '' : ' is-off'}`}>
                  <MeetTile size={40} />
                  <div>
                    <strong>
                      {o.google.connected ? 'Connected to Google Meet' : o.google.status === 'expired' ? 'Google needs reconnecting' : 'Google Meet not connected'}
                      {o.google.connected && <Icon name="checkCircle" size={15} />}
                    </strong>
                    <span>{o.google.connected ? `${o.google.account_email} is ready to use.` : 'Connect it to create Meet links and invites.'}</span>
                  </div>
                  <Link to="/settings" className="mh-manage">
                    Manage Connection <Icon name="arrow" size={14} />
                  </Link>
                </div>
              </section>

              <section className="pt-panel">
                <div className="mh-panel-head mh-panel-head--sm">
                  <Icon name="chart" size={18} />
                  <h2>Meeting Insights</h2>
                  <span className="pt-muted pt-small mh-push">This month</span>
                </div>
                <dl className="mh-insights">
                  <div>
                    <dd>{o.insights.meetings_this_month}</dd>
                    <dt>Total Meetings</dt>
                  </div>
                  <div>
                    <dd>{o.insights.attendance_rate === null ? '—' : `${o.insights.attendance_rate}%`}</dd>
                    <dt>Attendance Rate</dt>
                  </div>
                  <div>
                    <dd>{hm(o.insights.minutes_this_month)}</dd>
                    <dt>Total Time</dt>
                  </div>
                </dl>
                <Link to="/insights" className="pt-more mh-more">
                  All insights <Icon name="arrow" size={14} />
                </Link>
              </section>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const w = 96
  const h = 40
  const max = Math.max(1, ...values)
  const step = w / Math.max(1, values.length - 1)
  const pts = values.map((v, i) => [i * step, h - 4 - (v / max) * (h - 10)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg className="mh-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${line} L${w} ${h} L0 ${h} Z`} className="mh-spark-fill" />
      <path d={line} className="mh-spark-line" />
    </svg>
  )
}

function StatCard({ tone, icon, value, label, note, series, up = true }: { tone: string; icon: IconName; value: number; label: string; note: string; series: number[]; up?: boolean }) {
  return (
    <div className={`mh-stat mh-tone-${tone}`}>
      <span className="mh-stat-icon">
        <Icon name={icon} size={22} strokeWidth={2} />
      </span>
      <div className="mh-stat-text">
        <strong>{String(value).padStart(2, '0')}</strong>
        <span>{label}</span>
        <small className={up ? 'is-up' : 'is-down'}>
          <Icon name="up" size={12} strokeWidth={2.4} /> {note}
        </small>
      </div>
      <Sparkline values={series} />
    </div>
  )
}

function initials(name: string) {
  return name.split(/[\s@.]+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

const minutesBetween = (m: MeetingRow) => (m.scheduled_end ? Math.round((new Date(m.scheduled_end).getTime() - new Date(m.scheduled_start).getTime()) / 60000) : null)

function UpcomingList({ meetings }: { meetings: (MeetingRow & { people: string[] })[] }) {
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  if (meetings.length === 0) return <Empty>No meetings coming up. Schedule one, or start a call now.</Empty>
  return (
    <>
      {error && <p className="pt-error">{error}</p>}
      <ul className="mh-list">
        {meetings.map((m) => {
          const d = new Date(m.scheduled_start)
          const kind = KIND_ICON[m.category] ?? KIND_ICON.other
          const mins = minutesBetween(m)
          const joinable = canJoin(m)
          return (
            <li key={m.id}>
              <span className="mh-date">
                <small>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</small>
                <strong>{String(d.getDate()).padStart(2, '0')}</strong>
                <small>{d.toLocaleDateString('en-GB', { month: 'short' })}</small>
              </span>
              <span className={`mh-kind mh-tone-${kind.tone}`}>
                <Icon name={kind.icon} size={22} />
              </span>
              <Link to={`/${m.id}`} className="mh-main">
                <strong>{m.title}</strong>
                <span>
                  <Icon name="clock" size={14} /> {timeRange(m)}
                  {mins ? ` · ${hm(mins)}` : ''}
                </span>
                <span>
                  <Icon name="folder" size={14} /> {m.project_name || m.category_label}
                </span>
              </Link>
              <span className="mh-people" aria-label={`${m.participant_count} people`}>
                {m.people.slice(0, 3).map((p) => (
                  <span key={p} className="mh-face" title={p}>{initials(p)}</span>
                ))}
                {m.people.length > 3 && <span className="mh-face mh-face--more">+{m.people.length - 3}</span>}
              </span>
              <span className={`mh-pill mh-pill--${m.status === 'live' ? 'live' : joinable ? 'soon' : 'scheduled'}`}>
                {m.status === 'live' ? 'Live now' : joinable ? 'Upcoming' : 'Scheduled'}
              </span>
              {joinable ? (
                <button type="button" className="btn btn--sm mh-action" onClick={async () => setError((await joinMeeting(m.id)) ?? '')}>
                  <Icon name="video" size={16} /> Join Meeting
                </button>
              ) : (
                <Link to={`/${m.id}`} className="btn btn--sm btn--ghost mh-action">
                  View Details
                </Link>
              )}
              <span className="mh-more-wrap">
                <button type="button" className="mh-dots" aria-label={`More for ${m.title}`} aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)}>
                  <Icon name="dots" size={18} />
                </button>
                {open === m.id && (
                  <span className="mh-menu" role="menu">
                    <Link to={`/${m.id}`} role="menuitem" onClick={() => setOpen(null)}>Open meeting</Link>
                    {m.meet_uri && (
                      <button type="button" role="menuitem" onClick={() => { navigator.clipboard?.writeText(m.meet_uri).catch(() => undefined); setOpen(null) }}>
                        Copy Meet link
                      </button>
                    )}
                    <span className="mh-menu-note">{clock(m.scheduled_start)} · {m.organizer_name.split(' ')[0]} organizes</span>
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function MiniCalendar() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const from = isoDate(first)
  const to = isoDate(new Date(month.getFullYear(), month.getMonth(), days))
  const { data } = useApi<MeetingRow[]>(`/api/v1/meetings/?from=${from}&to=${to}`)
  const busy = useMemo(() => new Set((data ?? []).filter((m) => m.status !== 'cancelled').map((m) => isoDate(new Date(m.scheduled_start)))), [data])
  const today = isoDate()
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]

  return (
    <div className="mh-cal">
      <div className="mh-panel-head mh-panel-head--sm">
        <Icon name="calendar" size={18} />
        <h2>My Calendar</h2>
        <span className="mh-push mh-cal-nav">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <Icon name="left" size={16} />
          </button>
          <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <Icon name="right" size={16} />
          </button>
        </span>
      </div>
      <p className="mh-cal-month">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
      <div className="mh-cal-grid">
        {DOW.map((d) => (
          <span key={d} className="mh-cal-dow">{d}</span>
        ))}
        {cells.map((n, i) => {
          if (!n) return <span key={`x${i}`} />
          const key = isoDate(new Date(month.getFullYear(), month.getMonth(), n))
          return (
            <Link key={key} to={`/calendar?month=${key.slice(0, 7)}`} className={`mh-cal-day${key === today ? ' is-today' : ''}${busy.has(key) ? ' has-meeting' : ''}`} aria-label={`${key}${busy.has(key) ? ', has meetings' : ''}`}>
              {n}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
