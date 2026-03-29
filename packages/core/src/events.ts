import type { DB } from '@baubar/db'
import { events } from '@baubar/db'

export type DomainEventInput = {
  org_id: string
  actor_id: string | null
  event_type: string
  entity_type: string
  entity_id: string
  summary: string
  changes?: Record<string, { old: unknown; new: unknown }>
  payload: Record<string, unknown>
}

export async function emitEvent(tx: DB, event: DomainEventInput) {
  await tx.insert(events).values({
    org_id: event.org_id,
    actor_id: event.actor_id,
    event_type: event.event_type,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    summary: event.summary,
    changes: event.changes ?? null,
    payload: event.payload,
  })
}
