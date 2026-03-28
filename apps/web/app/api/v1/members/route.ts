import { NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { db, orgMembers, users } from '@baubar/db'
import { requireOrgContext } from '@/lib/api'

export async function GET() {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const rows = await db
    .select({ id: users.id, full_name: users.full_name, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.user_id, users.id))
    .where(and(eq(orgMembers.org_id, ctx!.orgId), isNull(orgMembers.deleted_at)))

  return NextResponse.json(rows)
}
