// The API runs on a primary server (Contabo) with a standby on the office machine.
// Requests go to the primary first and fall back to the next server when it is
// unreachable, too slow or erroring. In local development Vite proxies /api.
const DEFAULT_SERVERS = import.meta.env.DEV ? [''] : ['https://api.genmars.co.ke', 'https://backup.genmars.co.ke']

export const API_SERVERS: string[] = import.meta.env.VITE_API_URLS
  ? String(import.meta.env.VITE_API_URLS)
      .split(',')
      .map((s: string) => s.trim().replace(/\/+$/, ''))
  : DEFAULT_SERVERS

// The primary should answer fast; give the standby a little longer.
const PRIMARY_TIMEOUT_MS = 8_000
const BACKUP_TIMEOUT_MS = 20_000

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let lastError: unknown = new Error('No API servers configured')

  for (const [i, base] of API_SERVERS.entries()) {
    const isLast = i === API_SERVERS.length - 1
    try {
      const res = await fetch(`${base}${path}`, {
        ...init,
        signal: AbortSignal.timeout(i === 0 ? PRIMARY_TIMEOUT_MS : BACKUP_TIMEOUT_MS),
      })
      // 5xx means the server is unhealthy: try the next one if there is one.
      if (res.status >= 500 && !isLast) {
        lastError = new Error(`${base} answered ${res.status}`)
        continue
      }
      return res
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}
