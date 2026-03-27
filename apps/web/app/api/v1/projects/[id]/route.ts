import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { db, projects, projectStatuses, companies, contacts, customFieldDefinitions } from '@baubar/db'
import { updateProject, deleteProject } from '@baubar/core/mutations/projects'
import { requireOrgContext, handleError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      address: projects.address,
      planned_hours: projects.planned_hours,
      custom_properties: projects.custom_properties,
      created_at: projects.created_at,
      company_id: projects.company_id,
      contact_id: projects.contact_id,
      status_id: projects.status_id,
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
    .where(and(eq(projects.id, params.id), eq(projects.org_id, ctx!.orgId), isNull(projects.deleted_at)))
    .limit(1)

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const project = await updateProject(ctx!.user.id, ctx!.orgId, params.id, body)
    return NextResponse.json(project)
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    await deleteProject(ctx!.user.id, ctx!.orgId, params.id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}
