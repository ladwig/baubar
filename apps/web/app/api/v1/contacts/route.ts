import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { db, contacts, companies } from '@baubar/db'
import { createContact } from '@baubar/core/mutations/contacts'
import { requireOrgContext, handleError } from '@/lib/api'

export async function GET(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')

  const companyId = searchParams.get('company_id')

  const rows = await db
    .select({
      id: contacts.id,
      first_name: contacts.first_name,
      last_name: contacts.last_name,
      email: contacts.email,
      phone: contacts.phone,
      contact_type: contacts.contact_type,
      custom_properties: contacts.custom_properties,
      created_at: contacts.created_at,
      company: { id: companies.id, name: companies.name },
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.company_id, companies.id))
    .where(and(eq(contacts.org_id, ctx!.orgId), isNull(contacts.deleted_at)))
    .orderBy(desc(contacts.created_at))

  let result = rows
  if (companyId) result = result.filter((r) => r.company?.id === companyId)
  if (search) {
    const q = search.toLowerCase()
    result = result.filter(
      (r) =>
        r.first_name.toLowerCase().includes(q) ||
        r.last_name.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.company?.name.toLowerCase().includes(q)
    )
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const contact = await createContact(ctx!.user.id, ctx!.orgId, body)
    return NextResponse.json(contact, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
