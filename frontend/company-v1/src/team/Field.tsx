import type { ReactNode } from 'react'

export function Field({ label, error, children, wide }: { label: string; error?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? ' tm-wide' : ''}`} data-invalid={!!error}>
      {label}
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}
