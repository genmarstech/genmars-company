import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react'
import { authFetch } from '../auth/session'

// Brand files are served by the API to signed-in staff only, so they're fetched with the
// user's token and shown or saved from in-memory blobs rather than plain links.
const base = '/api/v1/team/brand/'

export function AuthImg({ path, ...rest }: { path: string } & ImgHTMLAttributes<HTMLImageElement>) {
  const [src, setSrc] = useState<string>()

  useEffect(() => {
    let url: string | undefined
    let cancelled = false
    authFetch(base + path)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (blob && !cancelled) {
          url = URL.createObjectURL(blob)
          setSrc(url)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [path])

  return src ? <img src={src} {...rest} /> : <span className="bk-img-loading" aria-hidden="true" />
}

export function DownloadLink({ path, className, children }: { path: string; className?: string; children: ReactNode }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const res = await authFetch(`${base}${path}?download=1`)
      if (!res.ok) throw new Error(String(res.status))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = path.split('/').pop() ?? 'download'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      window.alert('That file couldn’t be downloaded. Please sign in again and retry.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className={className ?? 'bk-file'} onClick={download} disabled={busy} aria-busy={busy}>
      {children}
    </button>
  )
}
