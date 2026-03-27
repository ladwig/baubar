import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { db, companies } from '@baubar/db'
import { updateCompany, deleteCompany } from '@baubar/core/mutations/companies'
import { requireOrgContext, handleError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, params.id), eq(companies.org_id, ctx!.orgId), isNull(companies.deleted_at)))
    .limit(1)

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(company)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const company = await updateCompany(ctx!.user.id, ctx!.orgId, params.id, body)
    return NextResponse.json(company)
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    await deleteCompany(ctx!.user.id, ctx!.orgId, params.id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}
