import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { postJson } from '../auth/session'
import { isoDate } from './shared'
import { clearTimer, useTimer } from './timerStore'

function clock(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Shown in the team header while a timer runs. Stop logs the time to the project. */
export function TimerChip() {
  const timer = useTimer()
  const [now, setNow] = useState(() => Date.now())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!timer) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [timer])

  if (!timer) return null
  const elapsed = Math.max(0, now - timer.startedAt)

  const stop = async () => {
    setSaving(true)
    setError('')
    try {
      await postJson('/api/v1/team/time/', {
        project: timer.project,
        task: timer.task ?? null,
        date: isoDate(new Date(timer.startedAt)),
        minutes: Math.min(24 * 60, Math.max(1, Math.round(elapsed / 60000))),
        note: timer.label,
      })
      clearTimer()
      window.dispatchEvent(new Event('genmars:time-logged'))
    } catch {
      setError('Couldn’t save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tm-timer" role="status">
      <span className="tm-timer-dot" aria-hidden="true" />
      <span className="tm-timer-label" title={timer.label}>
        {timer.label}
      </span>
      <span className="tm-timer-clock">{clock(elapsed)}</span>
      <button type="button" className="tm-timer-stop" onClick={stop} disabled={saving}>
        {saving ? 'Saving…' : 'Stop & log'}
      </button>
      <button type="button" className="pt-icon-btn tm-timer-x" aria-label="Discard timer" title="Discard timer" onClick={clearTimer}>
        <Icon name="close" size={14} />
      </button>
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
