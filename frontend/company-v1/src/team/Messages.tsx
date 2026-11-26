import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Empty, Loading, Panel, TeamLayout } from '../portal/PortalLayout'
import { timeAgo, useApi } from '../portal/useApi'
import { useMutation } from './shared'
import type { TeamMessage, TeamProject, Thread } from './types'

export function TeamMessages() {
  const [client, setClient] = useState(new URLSearchParams(window.location.search).get('client') ?? '')
  const threads = useApi<Thread[]>('/api/v1/team/threads/')
  const messages = useApi<TeamMessage[]>(client ? `/api/v1/team/messages/?client=${client}` : null)
  const projects = useApi<TeamProject[]>(client ? `/api/v1/team/projects/?client=${client}` : null)
  const [body, setBody] = useState('')
  const [project, setProject] = useState('')
  const { busy, message, run } = useMutation()
  const endRef = useRef<HTMLDivElement>(null)
  const current = threads.data?.find((t) => String(t.client) === client)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.data])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    if (await run('/api/v1/team/messages/', { client: Number(client), project: project ? Number(project) : null, body })) {
      setBody('')
      messages.reload()
      threads.reload()
    }
  }

  return (
    <TeamLayout title="Messages" subtitle="Conversations with clients. Replies are emailed to them too.">
      <div className={`tm-inbox${client ? ' tm-inbox--open' : ''}`}>
        <Panel className="tm-threads">
          {!threads.data ? (
            <Loading error={threads.error} />
          ) : threads.data.length === 0 && !client ? (
            <Empty>No conversations yet.</Empty>
          ) : (
            <ul>
              {threads.data.map((t) => (
                <li key={t.client}>
                  <button type="button" className="tm-thread" aria-current={String(t.client) === client} onClick={() => setClient(String(t.client))}>
                    <span className="tm-thread-top">
                      <strong>{t.client_name}</strong>
                      <span className="pt-muted pt-small">{timeAgo(t.last_at)}</span>
                    </span>
                    <span className="pt-muted pt-small tm-thread-last">{t.last_message}</span>
                    {t.needs_reply && <span className="tm-dot">Needs reply</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          className="pt-chat"
          title={current?.client_name}
          action={
            client && (
              <button type="button" className="tm-inbox-back" onClick={() => setClient('')}>
                ← All conversations
              </button>
            )
          }
        >
          {!client ? (
            <Empty>Choose a conversation.</Empty>
          ) : (
            <>
              <div className="pt-thread" aria-live="polite">
                {!messages.data ? (
                  <Loading error={messages.error} />
                ) : messages.data.length === 0 ? (
                  <Empty>No messages with this client yet. Start the conversation below.</Empty>
                ) : (
                  messages.data.map((m) => (
                    <div key={m.id} className={`pt-bubble${m.from_team ? ' pt-bubble--me' : ''}`}>
                      <span className="pt-bubble-meta">
                        {m.sender_name}
                        {m.project_name && ` · ${m.project_name}`} · {timeAgo(m.created_at)}
                        {m.from_team && (m.read_by_client ? ' · Seen' : '')}
                      </span>
                      <p>{m.body}</p>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>
              <form className="pt-compose" onSubmit={send}>
                {projects.data && projects.data.length > 0 && (
                  <select aria-label="About project" className="tm-compose-project" value={project} onChange={(e) => setProject(e.target.value)}>
                    <option value="">General</option>
                    {projects.data.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <label htmlFor="tm-reply" className="sr-only">
                  Reply
                </label>
                <textarea id="tm-reply" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" />
                <button type="submit" className="btn" disabled={busy || !body.trim()}>
                  <Icon name="send" size={16} /> Send
                </button>
              </form>
              {message && <p className="pt-error">{message}</p>}
            </>
          )}
        </Panel>
      </div>
    </TeamLayout>
  )
}
