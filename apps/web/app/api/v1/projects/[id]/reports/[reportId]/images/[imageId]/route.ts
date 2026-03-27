import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, reportImages } from '@baubar/db'
import { requireOrgContext, handleError } from '@/lib/api'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type Params = { params: { id: string; reportId: string; imageId: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error } = await requireOrgContext()
  if (error) return error

  try {
    const [image] = await db
      .select()
      .from(reportImages)
      .where(eq(reportImages.id, params.imageId))
      .limit(1)

    if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supabase = createSupabaseServerClient()
    await supabase.storage.from('report-images').remove([image.storage_path])

    await db.delete(reportImages).where(eq(reportImages.id, params.imageId))

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}
