import { Empty, Loading, Panel, PortalLayout, StatusBadge } from './PortalLayout'
import { formatDate, kes, useApi, type Invoice } from './useApi'

const tone: Record<string, string> = { paid: 'green', sent: 'blue', overdue: 'red' }

export function Invoices() {
  const { data, error } = useApi<Invoice[]>('/api/v1/portal/invoices/')
  const due = data?.filter((i) => i.status !== 'paid').reduce((sum, i) => sum + Number(i.amount), 0) ?? 0

  return (
    <PortalLayout title="Invoices" subtitle={data ? (due ? `${kes(due)} awaiting payment` : 'You’re all paid up.') : undefined}>
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <Panel>
          <Empty>No invoices yet.</Empty>
        </Panel>
      ) : (
        <Panel>
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Project</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Due</th>
                  <th scope="col" className="pt-num">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Pay</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.number}</strong>
                      {i.description && <span className="pt-muted pt-small pt-block">{i.description}</span>}
                    </td>
                    <td>{i.project_name || '—'}</td>
                    <td>{formatDate(i.issued_on)}</td>
                    <td>{i.status === 'paid' ? `Paid ${formatDate(i.paid_on)}` : formatDate(i.due_on)}</td>
                    <td className="pt-num">{kes(i.amount)}</td>
                    <td>
                      <StatusBadge tone={tone[i.status] ?? 'gray'}>{i.status_label}</StatusBadge>
                    </td>
                    <td>
                      {i.status !== 'paid' && i.payment_link && (
                        <a href={i.payment_link} className="btn btn--sm" target="_blank" rel="noopener noreferrer">
                          Pay now
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pt-muted pt-small pt-note">
            Pay by M-Pesa, bank transfer or card. Ask us in Messages if you need a copy of an invoice.
          </p>
        </Panel>
      )}
    </PortalLayout>
  )
}
