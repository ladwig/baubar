import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { db, projectReports, users } from '@baubar/db'
import { createReport } from '@baubar/core/mutations/reports'
import { requireOrgContext, handleError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const reports = await db
    .select({
      id: projectReports.id,
      report_type: projectReports.report_type,
      text_content: projectReports.text_content,
      custom_properties: projectReports.custom_properties,
      created_at: projectReports.created_at,
      author: { id: users.id, full_name: users.full_name },
    })
    .from(projectReports)
    .leftJoin(users, eq(projectReports.author_id, users.id))
    .where(
      and(
        eq(projectReports.project_id, params.id),
        eq(projectReports.org_id, ctx!.orgId),
        isNull(projectReports.deleted_at)
      )
    )
    .orderBy(desc(projectReports.created_at))

  return NextResponse.json(reports)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const report = await createReport(ctx!.user.id, ctx!.orgId, params.id, body)
    return NextResponse.json(report, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
