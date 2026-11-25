import { useState } from 'react'
import { Icon } from '../components/Icon'

type FieldProps = {
  label: string
  name: string
  type?: string
  autoComplete?: string
  icon: 'mail' | 'user' | 'lock'
  error?: string
  placeholder?: string
}

const icons = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
}

export function AuthField({ label, name, type = 'text', autoComplete, icon, error, placeholder }: FieldProps) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const id = `au-${name}`

  return (
    <div className="au-field" data-invalid={!!error}>
      <label htmlFor={id}>{label}</label>
      <div className="au-input">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icons[icon]}
        </svg>
        <input
          id={id}
          name={name}
          type={isPassword && visible ? 'text' : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="au-eye"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
              {visible && <path d="M3 3l18 18" />}
            </svg>
          </button>
        )}
      </div>
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}

export function SubmitButton({ busy, children }: { busy: boolean; children: string }) {
  return (
    <button type="submit" className="btn au-submit" disabled={busy}>
      {busy ? 'Please wait…' : children}
      {!busy && <Icon name="arrow" size={18} />}
    </button>
  )
}

export function FormMessage({ tone, children }: { tone: 'error' | 'ok'; children: string }) {
  return (
    <p className={`au-msg au-msg--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}
