import { useState } from 'react'
import { Link } from '../components/Link'
import { Empty, Loading, Panel, TeamLayout } from '../portal/PortalLayout'
import { formatDate, useApi } from '../portal/useApi'
import type { TeamClient } from './types'

export function Clients() {
  const [q, setQ] = useState('')
  const { data, error } = useApi<TeamClient[]>(`/api/v1/team/clients/${q ? `?q=${encodeURIComponent(q)}` : ''}`)

  return (
    <TeamLayout
      title="Clients"
      subtitle="Everyone with a client account."
      actions={
        <label className="pt-filter">
          <span className="sr-only">Search clients</span>
          <input className="tm-search" type="search" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      }
    >
      <Panel>
        {!data ? (
          <Loading error={error} />
        ) : data.length === 0 ? (
          <Empty>No clients{q ? ' match that search' : ' yet'}.</Empty>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Company</th>
                  <th scope="col">Phone</th>
                  <th scope="col" className="pt-num">Projects</th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.full_name}</strong>
                      <span className="pt-muted pt-small pt-block">{c.email}</span>
                    </td>
                    <td>{c.company_name || '—'}</td>
                    <td>{c.phone_number || '—'}</td>
                    <td className="pt-num">
                      {c.active_projects} active / {c.project_count}
                    </td>
                    <td>{formatDate(c.date_joined)}</td>
                    <td className="tm-row-actions">
                      <Link to={`/team/projects?client=${c.id}`}>Projects</Link>
                      <Link to={`/team/messages?client=${c.id}`}>Message</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </TeamLayout>
  )
}
