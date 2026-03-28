import { NextRequest, NextResponse } from 'next/server'
import { removeProjectMember } from '@baubar/core'
import { requireOrgContext, handleError } from '@/lib/api'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; userId: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    await removeProjectMember(ctx!.user.id, ctx!.orgId, params.id, params.userId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}
