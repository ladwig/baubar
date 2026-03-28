import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db, orgMembers } from '@baubar/db'
import { requireOrgContext, handleError } from '@/lib/api'

export async function DELETE(_req: NextRequest, { params }: { params: { userId: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    await db
      .update(orgMembers)
      .set({ deleted_at: new Date() })
      .where(and(eq(orgMembers.org_id, ctx!.orgId), eq(orgMembers.user_id, params.userId)))

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}
