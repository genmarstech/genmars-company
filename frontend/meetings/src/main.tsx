import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import './styles/shell.css'
import './styles/team.css'
import './styles/meetings.css'
import './styles/home.css'
import App from './App.tsx'
import { ErrorBoundary } from './ui/ErrorBoundary'

document.body.classList.add('theme-light')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
