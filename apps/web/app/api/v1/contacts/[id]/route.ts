import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { db, contacts } from '@baubar/db'
import { updateContact, deleteContact } from '@baubar/core/mutations/contacts'
import { requireOrgContext, handleError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, params.id), eq(contacts.org_id, ctx!.orgId), isNull(contacts.deleted_at)))
    .limit(1)

  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(contact)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const contact = await updateContact(ctx!.user.id, ctx!.orgId, params.id, body)
    return NextResponse.json(contact)
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    await deleteContact(ctx!.user.id, ctx!.orgId, params.id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}
