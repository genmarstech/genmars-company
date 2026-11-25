import { useEffect } from 'react'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { Contact } from './pages/Contact'
import { HowWeWork } from './pages/HowWeWork'
import { Services } from './pages/Services'
import { usePathname } from './router'

const routes: Record<string, { title: string; page: () => React.JSX.Element }> = {
  '/': { title: 'Genmars Tech · Websites and business software', page: Home },
  '/services': { title: 'Services & pricing · Genmars Tech', page: Services },
  '/how-we-work': { title: 'How we work · Genmars Tech', page: HowWeWork },
  '/contact': { title: 'Contact us · Genmars Tech', page: Contact },
}

function App() {
  const path = usePathname().replace(/\/+$/, '') || '/'
  const route = routes[path]
  const Page = route?.page ?? NotFound

  useEffect(() => {
    document.title = route?.title ?? 'Page not found · Genmars Tech'
  }, [route])

  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [])

  return (
    // The homepage hero is dark; every other page uses the light theme.
    <div className={path === '/' ? 'site' : 'site theme-light'}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Page />
      </main>
      <SiteFooter />
    </div>
  )
}

export default App
