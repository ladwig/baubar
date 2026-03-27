import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { db, customFieldDefinitions } from '@baubar/db'
import { requireOrgContext, handleError } from '@/lib/api'
import { z } from 'zod'

const createFieldSchema = z.object({
  entity_type: z.enum(['project', 'company', 'contact', 'report']),
  name: z.string().min(1).regex(/^[a-z_]+$/, 'Only lowercase letters and underscores'),
  label: z.string().min(1),
  field_type: z.enum(['text', 'number', 'boolean', 'date', 'select']),
  options: z.array(z.string()).optional(),
  sort_order: z.number().int().default(0),
})

export async function GET(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entity_type')

  const conditions = [
    eq(customFieldDefinitions.org_id, ctx!.orgId),
    isNull(customFieldDefinitions.deleted_at),
  ]
  if (entityType) conditions.push(eq(customFieldDefinitions.entity_type, entityType))

  const fields = await db
    .select()
    .from(customFieldDefinitions)
    .where(and(...conditions))
    .orderBy(asc(customFieldDefinitions.sort_order))

  return NextResponse.json(fields)
}

export async function POST(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const data = createFieldSchema.parse(body)
    const [field] = await db
      .insert(customFieldDefinitions)
      .values({
        org_id: ctx!.orgId,
        ...data,
        options: data.options ?? null,
      })
      .returning()
    return NextResponse.json(field, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const { id } = await req.json()
    await db
      .update(customFieldDefinitions)
      .set({ deleted_at: new Date() })
      .where(
        and(
          eq(customFieldDefinitions.id, id),
          eq(customFieldDefinitions.org_id, ctx!.orgId)
        )
      )
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}
