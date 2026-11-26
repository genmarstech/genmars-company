import { Component, type ReactNode } from 'react'

/** If a page breaks (say, the API answers in an older shape), show a way out instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Meetings page failed to render', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="ml-login">
        <div className="pt-panel ml-login-card">
          <h1>Something went wrong</h1>
          <p className="pt-muted">This page couldn’t load. Reload to try again, or go back to the overview.</p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a href="/" className="pt-small ml-forgot">
            Go to the overview
          </a>
        </div>
      </main>
    )
  }
}
