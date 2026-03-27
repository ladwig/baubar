import { NextRequest, NextResponse } from 'next/server'
import { updateReport, deleteReport } from '@baubar/core/mutations/reports'
import { requireOrgContext, handleError } from '@/lib/api'

type Params = { params: { id: string; reportId: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = await req.json()
    const report = await updateReport(ctx!.user.id, ctx!.orgId, params.reportId, body)
    return NextResponse.json(report)
  } catch (err) {
    return handleError(err)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    await deleteReport(ctx!.user.id, ctx!.orgId, params.reportId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}
