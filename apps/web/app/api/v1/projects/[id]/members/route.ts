import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { db, projectMembers, users } from '@baubar/db'
import { addProjectMember } from '@baubar/core'
import { requireOrgContext, handleError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const rows = await db
    .select({ user_id: users.id, full_name: users.full_name, role: projectMembers.role })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.user_id, users.id))
    .where(and(eq(projectMembers.project_id, params.id), isNull(projectMembers.deleted_at)))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const { user_id } = await req.json()
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 422 })

    const member = await addProjectMember(ctx!.user.id, ctx!.orgId, params.id, user_id)
    return NextResponse.json(member, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
