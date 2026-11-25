import { useSyncExternalStore } from 'react'
import { apiFetch } from '../api'

// The signed-in user's API token lives in localStorage so it survives reloads.
const TOKEN_KEY = 'genmars.token'
const USER_KEY = 'genmars.user'

export type User = {
  id: number
  full_name: string
  email: string
  phone_number: string
  is_staff: boolean
  date_joined: string
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
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await authFetch(path, { method: 'POST', body: JSON.stringify(body) })
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
  const message = typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : ''
  throw new ApiError(message || (Object.keys(fields).length ? '' : 'Something went wrong. Please try again.'), fields)
}

type AuthResponse = { token: string; user: User }

export async function login(email: string, password: string) {
  const data = await postJson<AuthResponse>('/api/v1/auth/login/', { email, password })
  setSession(data)
  return data.user
}

export async function signUp(fullName: string, email: string, password: string) {
  const data = await postJson<AuthResponse>('/api/v1/auth/users/register/', {
    full_name: fullName,
    email,
    password,
  })
  setSession(data)
  return data.user
}

export async function resetPassword(uid: string, token: string, password: string) {
  const data = await postJson<AuthResponse>('/api/v1/auth/password-reset/confirm/', { uid, token, password })
  setSession(data)
  return data.user
}

export function requestPasswordReset(email: string) {
  return postJson<{ message: string }>('/api/v1/auth/password-reset/', { email })
}

export async function logout() {
  try {
    await authFetch('/api/v1/auth/logout/', { method: 'POST' })
  } catch {
    // signing out locally is enough if the server can't be reached
  }
  setSession({ token: null, user: null })
}

/** Re-check the stored token with the server and refresh the cached profile. */
export async function refreshUser() {
  if (!session.token) return null
  try {
    const res = await authFetch('/api/v1/auth/users/me/')
    if (!res.ok) return null
    const user = (await res.json()) as User
    setSession({ token: session.token, user })
    return user
  } catch {
    return session.user
  }
}
