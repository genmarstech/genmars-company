import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, postJson } from '../auth/session'
import { Icon } from '../components/Icon'
import { Empty, Loading, Panel, PortalLayout } from './PortalLayout'
import { timeAgo, useApi, type Message, type Project } from './useApi'

export function Messages() {
  const initialProject = new URLSearchParams(window.location.search).get('project') ?? ''
  const [project, setProject] = useState(initialProject)
  const projects = useApi<Project[]>('/api/v1/portal/projects/')
  const messages = useApi<Message[]>(`/api/v1/portal/messages/${project ? `?project=${project}` : ''}`)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.data])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError('')
    try {
      await postJson('/api/v1/portal/messages/', { body, project: project ? Number(project) : null })
      setBody('')
      messages.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message || Object.values(err.fields)[0] || 'Couldn’t send.' : 'Couldn’t send.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PortalLayout
      title="Messages"
      subtitle="Talk to the team working on your project. We usually reply within a working day."
      actions={
        projects.data && projects.data.length > 0 && (
          <label className="pt-filter">
            <span className="sr-only">Project</span>
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">All conversations</option>
              {projects.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )
      }
    >
      <Panel className="pt-chat">
        <div className="pt-thread" aria-live="polite">
          {!messages.data ? (
            <Loading error={messages.error} />
          ) : messages.data.length === 0 ? (
            <Empty>No messages yet. Say hello, or ask us anything about your project.</Empty>
          ) : (
            messages.data.map((m) => (
              <div key={m.id} className={`pt-bubble${m.from_team ? '' : ' pt-bubble--me'}`}>
                <span className="pt-bubble-meta">
                  {m.sender_name}
                  {!project && m.project_name && ` · ${m.project_name}`} · {timeAgo(m.created_at)}
                </span>
                <p>{m.body}</p>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
        <form className="pt-compose" onSubmit={send}>
          <label htmlFor="pt-message" className="sr-only">
            Message
          </label>
          <textarea
            id="pt-message"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <button type="submit" className="btn" disabled={busy || !body.trim()}>
            <Icon name="send" size={16} /> Send
          </button>
        </form>
        {error && <p className="pt-error">{error}</p>}
      </Panel>
    </PortalLayout>
  )
}
