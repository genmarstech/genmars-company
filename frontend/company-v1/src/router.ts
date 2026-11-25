import { useEffect, useState } from 'react'

// A tiny client-side router: the marketing site only needs a few static pages,
// so we avoid pulling in a routing library for now.

const NAV_EVENT = 'genmars:navigate'

export function navigate(to: string) {
  const url = new URL(to, window.location.origin)
  const samePage = url.pathname === window.location.pathname
  window.history.pushState({}, '', url.pathname + url.hash)
  window.dispatchEvent(new Event(NAV_EVENT))

  requestAnimationFrame(() => {
    const target = url.hash ? document.getElementById(url.hash.slice(1)) : null
    if (target) target.scrollIntoView({ behavior: samePage ? 'smooth' : 'auto' })
    else window.scrollTo({ top: 0 })
  })
}

export function usePathname() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener(NAV_EVENT, update)
    window.addEventListener('popstate', update)
    return () => {
      window.removeEventListener(NAV_EVENT, update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return path
}
