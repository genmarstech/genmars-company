import type { ProjectRef } from '../meetingTypes'

/** Project choices for a <select>: client work and our own products in separate groups. */
export function ProjectOptions({ projects, detail = true }: { projects?: ProjectRef[]; detail?: boolean }) {
  if (!projects) return null
  const client = projects.filter((p) => p.kind !== 'internal')
  const internal = projects.filter((p) => p.kind === 'internal')
  return (
    <>
      {client.length > 0 && (
        <optgroup label="Client projects">
          {client.map((p) => (
            <option key={p.id} value={p.id}>
              {detail ? `${p.name} · ${p.client_name}` : p.name}
            </option>
          ))}
        </optgroup>
      )}
      {internal.length > 0 && (
        <optgroup label="Internal projects">
          {internal.map((p) => (
            <option key={p.id} value={p.id}>
              {detail ? `${p.name} · ${p.stage === 'production' ? 'Live' : 'Testing'}` : p.name}
            </option>
          ))}
        </optgroup>
      )}
    </>
  )
}
