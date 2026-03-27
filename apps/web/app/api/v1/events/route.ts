import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { db, events, users } from '@baubar/db'
import { requireOrgContext } from '@/lib/api'

export async function GET(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get('entity_id')
  const entityType = searchParams.get('entity_type')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50

  const conditions = [eq(events.org_id, ctx!.orgId)]
  if (entityId) conditions.push(eq(events.entity_id, entityId))
  if (entityType) conditions.push(eq(events.entity_type, entityType))

  const rows = await db
    .select({
      id: events.id,
      event_type: events.event_type,
      entity_type: events.entity_type,
      entity_id: events.entity_id,
      summary: events.summary,
      changes: events.changes,
      created_at: events.created_at,
      actor: { id: users.id, full_name: users.full_name },
    })
    .from(events)
    .leftJoin(users, eq(events.actor_id, users.id))
    .where(and(...conditions))
    .orderBy(desc(events.created_at))
    .limit(limit)

  return NextResponse.json(rows)
}
