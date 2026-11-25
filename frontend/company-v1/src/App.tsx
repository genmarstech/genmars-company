import { useEffect } from 'react'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { About } from './pages/About'
import { Brand } from './pages/Brand'
import { Contact } from './pages/Contact'
import { Privacy, Terms } from './pages/Legal'
import { Products } from './pages/Products'
import { HowWeWork } from './pages/HowWeWork'
import { Services } from './pages/Services'
import { Onboarding } from './pages/Onboarding'
import { Portal } from './portal'
import { Team } from './team'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignUpPage } from './auth/pages'
import { navigate, usePathname } from './router'

type Route = { title: string; page: () => React.JSX.Element | null; bare?: boolean }

const routes: Record<string, Route> = {
  '/': { title: 'Genmars Tech · Websites and business software', page: Home },
  '/services': { title: 'Services & pricing · Genmars Tech', page: Services },
  '/how-we-work': { title: 'How we work · Genmars Tech', page: HowWeWork },
  '/contact': { title: 'Contact us · Genmars Tech', page: Contact },
  '/about': { title: 'About us · Genmars Tech', page: About },
  '/products': { title: 'Products · Genmars Labs', page: Products },
  '/brand': { title: 'Brand kit · Genmars Tech', page: Brand },
  '/privacy': { title: 'Privacy policy · Genmars Tech', page: Privacy },
  '/terms': { title: 'Terms of service · Genmars Tech', page: Terms },
  '/login': { title: 'Sign in · Genmars Tech', page: LoginPage, bare: true },
  '/signup': { title: 'Create your account · Genmars Tech', page: SignUpPage, bare: true },
  '/forgot-password': { title: 'Forgot password · Genmars Tech', page: ForgotPasswordPage, bare: true },
  '/reset-password': { title: 'Choose a new password · Genmars Tech', page: ResetPasswordPage, bare: true },
  '/onboarding': { title: 'Set up your account · Genmars Tech', page: Onboarding, bare: true },
}

function App() {
  const path = usePathname().replace(/\/+$/, '') || '/'
  const route = routes[path]
  const Page = route?.page ?? NotFound

  useEffect(() => {
    document.title = path.startsWith('/team')
      ? 'Team · Genmars Tech'
      : path.startsWith('/portal')
      ? 'Client portal · Genmars Tech'
      : (route?.title ?? 'Page not found · Genmars Tech')
  }, [route, path])

  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [])

  useEffect(() => {
    // the old account page now lives in the client portal
    if (path === '/account') navigate('/portal')
  }, [path])

  if (path === '/team' || path.startsWith('/team/')) {
    return (
      <div className="site theme-light">
        <Team path={path} />
      </div>
    )
  }

  if (path === '/portal' || path.startsWith('/portal/')) {
    return (
      <div className="site theme-light">
        <Portal path={path} />
      </div>
    )
  }

  // Sign-in pages stand alone, without the site header and footer.
  if (route?.bare) {
    return (
      <div className="site theme-light">
        <main id="main">
          <Page />
        </main>
      </div>
    )
  }

  return (
    <div className="site theme-light">
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
