import { NextRequest, NextResponse } from 'next/server'
import { db, reportImages } from '@baubar/db'
import { requireOrgContext, handleError } from '@/lib/api'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

type Params = { params: { id: string; reportId: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const contentType = req.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/json')) {
      // --- Agent path: move from temp/ to final location ---
      // If gateway and web app share the same Supabase project, this is a
      // cheap rename. If they are on separate projects in the future, replace
      // the move() call with: download via signed URL + reupload.
      const { temp_path } = await req.json() as { temp_path?: string }
      if (!temp_path) return NextResponse.json({ error: 'temp_path fehlt.' }, { status: 400 })

      // Security: only allow moving files that belong to this org's temp folder
      if (!temp_path.startsWith(`${ctx!.orgId}/temp/`)) {
        return NextResponse.json({ error: 'Ungültiger temp_path.' }, { status: 403 })
      }

      const filename = temp_path.split('/').pop()!
      const finalPath = `${ctx!.orgId}/${params.reportId}/${filename}`

      // Use admin client for the move: service-to-service calls have no user
      // session so the regular server client would be unauthenticated (anon role)
      // which has no SELECT/DELETE rights needed by the move operation.
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
    }

    // --- Web UI path: direct file upload ---
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Keine Datei übermittelt.' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Ungültiger Dateityp. Erlaubt: JPEG, PNG, WebP, GIF.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Datei zu groß. Maximum: 10 MB.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    // Path: {org_id}/{report_id}/{filename}  ← org_id is the first segment for storage RLS
    const storagePath = `${ctx!.orgId}/${params.reportId}/${filename}`

    const supabase = createSupabaseServerClient()
    const { error: uploadError } = await supabase.storage
      .from('report-images')
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Upload fehlgeschlagen.' }, { status: 500 })
    }

    const [image] = await db
      .insert(reportImages)
      .values({ report_id: params.reportId, storage_path: storagePath, uploaded_by: ctx!.user.id })
      .returning()

    const { data: signed } = await supabase.storage
      .from('report-images')
      .createSignedUrl(storagePath, 3600)

    return NextResponse.json({ ...image, url: signed?.signedUrl ?? null }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
