import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { db, projects, projectStatuses, companies, contacts } from '@baubar/db'
import { createProject } from '@baubar/core/mutations/projects'
import { requireOrgContext, handleError } from '@/lib/api'

export async function GET(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statusType = searchParams.get('status_type')
  const search = searchParams.get('search')

  const companyId = searchParams.get('company_id')
  const contactId = searchParams.get('contact_id')

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      address: projects.address,
      planned_hours: projects.planned_hours,
      custom_properties: projects.custom_properties,
      company_id: projects.company_id,
      contact_id: projects.contact_id,
      created_at: projects.created_at,
      status: {
        id: projectStatuses.id,
        label: projectStatuses.label,
        color: projectStatuses.color,
        status_type: projectStatuses.status_type,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(projects)
    .leftJoin(projectStatuses, eq(projects.status_id, projectStatuses.id))
    .leftJoin(companies, eq(projects.company_id, companies.id))
    .where(and(eq(projects.org_id, ctx!.orgId), isNull(projects.deleted_at)))
    .orderBy(desc(projects.created_at))

  let result = rows
  if (statusType) result = result.filter((r) => r.status?.status_type === statusType)
  if (companyId) result = result.filter((r) => r.company_id === companyId)
  if (contactId) result = result.filter((r) => r.contact_id === contactId)
  if (search) {
    const q = search.toLowerCase()
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.address?.toLowerCase().includes(q) ||
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
    const project = await createProject(ctx!.user.id, ctx!.orgId, body)
    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
