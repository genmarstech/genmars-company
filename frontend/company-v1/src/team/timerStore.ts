import { useSyncExternalStore } from 'react'

// One running timer per browser, kept in localStorage so it survives reloads and page changes.
type Running = { project: number; task?: number; label: string; startedAt: number }
const KEY = 'genmars.timer'
const EVENT = 'genmars:timer'

function read(): Running | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Running) : null
  } catch {
    return null
  }
}

let current = read()

function write(next: Running | null) {
  current = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: the timer still works until the tab closes */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function startTimer(t: Omit<Running, 'startedAt'>) {
  write({ ...t, startedAt: Date.now() })
}

export function useTimer() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb)
      return () => window.removeEventListener(EVENT, cb)
    },
    () => current,
  )
}

export const clearTimer = () => write(null)
