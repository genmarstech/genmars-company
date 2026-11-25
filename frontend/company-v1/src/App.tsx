import { useEffect } from 'react'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { Contact } from './pages/Contact'
import { HowWeWork } from './pages/HowWeWork'
import { Services } from './pages/Services'
import { Account } from './pages/Account'
import { Onboarding } from './pages/Onboarding'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignUpPage } from './auth/pages'
import { usePathname } from './router'

type Route = { title: string; page: () => React.JSX.Element | null; bare?: boolean }

const routes: Record<string, Route> = {
  '/': { title: 'Genmars Tech · Websites and business software', page: Home },
  '/services': { title: 'Services & pricing · Genmars Tech', page: Services },
  '/how-we-work': { title: 'How we work · Genmars Tech', page: HowWeWork },
  '/contact': { title: 'Contact us · Genmars Tech', page: Contact },
  '/login': { title: 'Sign in · Genmars Tech', page: LoginPage, bare: true },
  '/signup': { title: 'Create your account · Genmars Tech', page: SignUpPage, bare: true },
  '/forgot-password': { title: 'Forgot password · Genmars Tech', page: ForgotPasswordPage, bare: true },
  '/reset-password': { title: 'Choose a new password · Genmars Tech', page: ResetPasswordPage, bare: true },
  '/onboarding': { title: 'Set up your account · Genmars Tech', page: Onboarding, bare: true },
  '/account': { title: 'Your account · Genmars Tech', page: Account },
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
