import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { db, projectStatuses } from '@baubar/db'
import { requireOrgContext, handleError } from '@/lib/api'
import { z } from 'zod'

const createStatusSchema = z.object({
  label: z.string().min(1),
  status_type: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'DONE']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6B7280'),
  sort_order: z.number().int().default(0),
})

const updateStatusSchema = z.object({
  label: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sort_order: z.number().int().optional(),
  is_default: z.boolean().optional(),
})

export async function GET(_req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const statuses = await db
    .select()
    .from(projectStatuses)
    .where(and(eq(projectStatuses.org_id, ctx!.orgId), isNull(projectStatuses.deleted_at)))
    .orderBy(asc(projectStatuses.sort_order))

  return NextResponse.json(statuses)
}

export async function POST(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const data = createStatusSchema.parse(body)
    const [status] = await db
      .insert(projectStatuses)
      .values({ org_id: ctx!.orgId, ...data })
      .returning()
    return NextResponse.json(status, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}

export async function PATCH(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const { id, ...rest } = body
    const data = updateStatusSchema.parse(rest)
    const [status] = await db
      .update(projectStatuses)
      .set(data)
      .where(and(eq(projectStatuses.id, id), eq(projectStatuses.org_id, ctx!.orgId)))
      .returning()
    return NextResponse.json(status)
  } catch (err) {
    return handleError(err)
  }
}
