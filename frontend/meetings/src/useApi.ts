import { useCallback, useEffect, useState } from 'react'
import { authFetch } from './session'

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
