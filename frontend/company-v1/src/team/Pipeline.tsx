import { Empty, Loading, TeamLayout } from '../portal/PortalLayout'
import { formatDate, useApi } from '../portal/useApi'
import { useMutation } from './shared'
import type { Lead } from './types'

const COLUMNS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'proposal_sent', label: 'Proposal sent' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

export function Pipeline() {
  const { data, error, reload } = useApi<(Lead & { source_label: string })[]>('/api/v1/enquiries/inbox/')
  const { busy, run } = useMutation()

  const move = async (lead: Lead, status: string) => {
    if (await run(`/api/v1/enquiries/inbox/${lead.id}/`, { status }, 'PATCH')) reload()
  }

  return (
    <TeamLayout title="Sales pipeline" subtitle="Every lead by stage. Move a card with its stage menu.">
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <Empty>No leads yet. Website briefs, portal requests and early-access sign-ups land here.</Empty>
      ) : (
        <div className="tm-board">
          {COLUMNS.map((col) => {
            const cards = data.filter((l) => l.status === col.value)
            return (
              <section key={col.value} className={`tm-col tm-col--${col.value}`} aria-label={col.label}>
                <h2>
                  {col.label} <span>{cards.length}</span>
                </h2>
                {cards.map((l) => (
                  <article key={l.id} className="tm-card">
                    <strong>{l.full_name}</strong>
                    <span className="pt-muted pt-small">
                      {l.service_label} · {l.budget_label}
                    </span>
                    <p>{l.message}</p>
                    <div className="tm-card-foot">
                      <span className="pt-muted pt-small">
                        {l.source_label} · {formatDate(l.created_at, false)}
                      </span>
                      <select aria-label={`Stage for ${l.full_name}`} value={l.status} disabled={busy} onChange={(e) => move(l, e.target.value)}>
                        {COLUMNS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </section>
            )
          })}
        </div>
      )}
    </TeamLayout>
  )
}
