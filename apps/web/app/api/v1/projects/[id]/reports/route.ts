import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull, desc, inArray } from 'drizzle-orm'
import { db, projectReports, reportImages, users } from '@baubar/db'
import { createReport } from '@baubar/core/mutations/reports'
import { requireOrgContext, handleError } from '@/lib/api'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

  if (reports.length === 0) return NextResponse.json([])

  // Fetch images for all reports in one query
  const reportIds = reports.map((r) => r.id)
  const images = await db
    .select()
    .from(reportImages)
    .where(inArray(reportImages.report_id, reportIds))
    .orderBy(reportImages.created_at)

  // Generate signed URLs for all images (1 h expiry)
  let imageMap: Record<string, { id: string; storage_path: string; url: string }[]> = {}
  if (images.length > 0) {
    const supabase = createSupabaseServerClient()
    const signed = await supabase.storage
      .from('report-images')
      .createSignedUrls(images.map((i) => i.storage_path), 3600)

    images.forEach((img, idx) => {
      const url = signed.data?.[idx]?.signedUrl ?? null
      if (!imageMap[img.report_id]) imageMap[img.report_id] = []
      if (url) imageMap[img.report_id].push({ id: img.id, storage_path: img.storage_path, url })
    })
  }

  return NextResponse.json(reports.map((r) => ({ ...r, images: imageMap[r.id] ?? [] })))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const report = await createReport(ctx!.user.id, ctx!.orgId, params.id, body)
    return NextResponse.json({ ...report, images: [] }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
