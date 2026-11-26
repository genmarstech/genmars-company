import { useSyncExternalStore } from 'react'
import { apiFetch } from './api'

// Sign-in uses the main Genmars API, so the same team account works here. The token lives in this
// site's localStorage so it survives reloads.
const TOKEN_KEY = 'genmars.token'
const USER_KEY = 'genmars.user'

export type User = {
  id: number
  full_name: string
  email: string
  is_staff: boolean
}

type Session = { token: string | null; user: User | null }

function read(): Session {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const user = localStorage.getItem(USER_KEY)
    return { token, user: token && user ? (JSON.parse(user) as User) : null }
  } catch {
    return { token: null, user: null }
  }
}

let session = read()
const listeners = new Set<() => void>()

function setSession(next: Session) {
  session = next
  try {
    if (next.token && next.user) {
      localStorage.setItem(TOKEN_KEY, next.token)
      localStorage.setItem(USER_KEY, JSON.stringify(next.user))
    } else {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  } catch {
    // storage blocked (private mode): the session still works until reload
  }
  listeners.forEach((l) => l())
}

export function useSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => session,
  )
}

/** Calls the API with the user's token, and signs them out if the server rejects it. */
export async function authFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (session.token) headers.set('Authorization', `Token ${session.token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await apiFetch(path, { ...init, headers })
  if (res.status === 401 && session.token) setSession({ token: null, user: null })
  return res
}

export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  fields: FieldErrors
  constructor(message: string, fields: FieldErrors = {}) {
    super(message)
    this.fields = fields
  }
}

/** POST JSON and return the parsed body, turning Django errors into an ApiError. */
export async function postJson<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  let res: Response
  try {
    res = await authFetch(path, { method, body: JSON.stringify(body) })
  } catch {
    throw new ApiError('We couldn’t reach our servers. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (res.ok) return data as T
  if (res.status === 429) throw new ApiError('Too many attempts. Please wait a minute and try again.')

  const fields: FieldErrors = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(value)) fields[key] = String(value[0])
  }
  const { error, detail } = data as { error?: unknown; detail?: unknown }
  const message = typeof error === 'string' ? error : typeof detail === 'string' ? detail : ''
  throw new ApiError(message || (Object.keys(fields).length ? '' : 'Something went wrong. Please try again.'), fields)
}

type AuthResponse = { token: string; user: User }

export async function login(email: string, password: string) {
  const data = await postJson<AuthResponse>('/api/v1/auth/login/', { email, password })
  if (!data.user.is_staff) throw new ApiError('Meetings is for the Genmars team. Sign in with your team account.')
  setSession(data)
  return data.user
}

/** Forget the token here only. The main site may share it, so it isn't revoked on the server. */
export function logout() {
  setSession({ token: null, user: null })
}
