import { NextRequest, NextResponse } from 'next/server'
import { db, reportImages } from '@baubar/db'
import { requireOrgContext, handleError } from '@/lib/api'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

type Params = { params: { id: string; reportId: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
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
