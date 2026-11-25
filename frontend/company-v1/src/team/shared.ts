import { useState, type FormEvent } from 'react'
import { ApiError, postJson, type FieldErrors } from '../auth/session'

/** Submit a form to the team API and surface field errors. */
export function useMutation() {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')

  async function run(path: string, body: unknown, method = 'POST') {
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      return await postJson<unknown>(path, body, method)
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields)
        setMessage(e.message || Object.values(e.fields)[0] || 'Please check the form.')
      }
      return null
    } finally {
      setBusy(false)
    }
  }
  return { busy, errors, message, run }
}

export function formData(e: FormEvent<HTMLFormElement>) {
  const out: Record<string, string | null> = {}
  new FormData(e.currentTarget).forEach((v, k) => {
    out[k] = String(v).trim() === '' ? null : String(v).trim()
  })
  return out
}
