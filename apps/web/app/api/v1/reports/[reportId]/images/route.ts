import { NextRequest, NextResponse } from 'next/server'
import { db, reportImages } from '@baubar/db'
import { requireOrgContext, handleError } from '@/lib/api'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

type Params = { params: { reportId: string } }

/**
 * POST /api/v1/reports/:reportId/images
 *
 * Agent path only — moves a temp image to its final location and records it.
 * Body: { temp_path: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const { temp_path } = await req.json() as { temp_path?: string }
    if (!temp_path) return NextResponse.json({ error: 'temp_path fehlt.' }, { status: 400 })

    if (!temp_path.startsWith(`${ctx!.orgId}/temp/`)) {
      return NextResponse.json({ error: 'Ungültiger temp_path.' }, { status: 403 })
    }

    const filename = temp_path.split('/').pop()!
    const finalPath = `${ctx!.orgId}/${params.reportId}/${filename}`

    const supabase = createSupabaseAdminClient()
    const { error: moveError } = await supabase.storage
      .from('report-images')
      .move(temp_path, finalPath)

    if (moveError) {
      console.error('Storage move error:', moveError)
      return NextResponse.json({ error: 'Verschieben fehlgeschlagen.' }, { status: 500 })
    }

    const [image] = await db
      .insert(reportImages)
      .values({ report_id: params.reportId, storage_path: finalPath, uploaded_by: ctx!.user.id ?? null })
      .returning()

    const { data: signed } = await supabase.storage
      .from('report-images')
      .createSignedUrl(finalPath, 3600)

    return NextResponse.json({ ...image, url: signed?.signedUrl ?? null }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
