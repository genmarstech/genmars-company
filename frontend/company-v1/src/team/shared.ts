import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, postJson, type FieldErrors } from '../auth/session'

/** Submit a form to the team API and surface field errors. */
export function useMutation() {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')

  async function run(path: string, body: unknown, method = 'POST') {
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      return await postJson<unknown>(path, body, method)
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields)
        setMessage(e.message || Object.values(e.fields)[0] || 'Please check the form.')
      }
      return null
    } finally {
      setBusy(false)
    }
  }
  return { busy, errors, message, run }
}

export function formData(e: FormEvent<HTMLFormElement>) {
  const out: Record<string, string | null> = {}
  new FormData(e.currentTarget).forEach((v, k) => {
    out[k] = String(v).trim() === '' ? null : String(v).trim()
  })
  return out
}

/** "1h 30m", "45m", "0m" */
export function hm(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

/** Read "1.5", "1:30", "90m", "1h 30m" or "2h" as minutes. Returns null if it can't. */
export function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase()
  const clock = s.match(/^(\d+):(\d{1,2})$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  const units = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/)
  if (units && (units[1] || units[2])) return Math.round(Number(units[1] ?? 0) * 60) + Number(units[2] ?? 0)
  if (/^\d+(?:\.\d+)?$/.test(s)) return Math.round(Number(s) * 60)
  return null
}

/** Local date as YYYY-MM-DD (not UTC, so late-evening entries land on the right day). */
export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** After a list loads, scroll to the #anchor from the URL (e.g. a search result) and mark it briefly. */
export function useScrollToHash(ready: boolean) {
  useEffect(() => {
    if (!ready || !window.location.hash) return
    const el = document.getElementById(window.location.hash.slice(1))
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.setAttribute('data-found', 'true')
    const t = window.setTimeout(() => el.removeAttribute('data-found'), 2400)
    return () => window.clearTimeout(t)
  }, [ready])
}

/** Reload when a running timer logs time. */
export function useOnTimeLogged(reload: () => void) {
  useEffect(() => {
    window.addEventListener('genmars:time-logged', reload)
    return () => window.removeEventListener('genmars:time-logged', reload)
  }, [reload])
}
