import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull, desc, sql } from 'drizzle-orm'
import { db, companies, contacts, projects } from '@baubar/db'
import { createCompany } from '@baubar/core/mutations/companies'
import { requireOrgContext, handleError } from '@/lib/api'

export async function GET(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')

  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      address: companies.address,
      industry: companies.industry,
      custom_properties: companies.custom_properties,
      created_at: companies.created_at,
    })
    .from(companies)
    .where(and(eq(companies.org_id, ctx!.orgId), isNull(companies.deleted_at)))
    .orderBy(desc(companies.created_at))

  let result = rows
  if (search) {
    const q = search.toLowerCase()
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.industry?.toLowerCase().includes(q) ||
        r.address?.toLowerCase().includes(q)
    )
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const company = await createCompany(ctx!.user.id, ctx!.orgId, body)
    return NextResponse.json(company, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
