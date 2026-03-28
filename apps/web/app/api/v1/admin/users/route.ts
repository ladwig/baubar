import { NextRequest, NextResponse } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, orgMembers, users } from '@baubar/db'
import { requireOrgContext, handleError } from '@/lib/api'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const rows = await db
    .select({ id: users.id, full_name: users.full_name, role: orgMembers.role, created_at: users.created_at, removed_at: orgMembers.deleted_at })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.user_id, users.id))
    .where(eq(orgMembers.org_id, ctx!.orgId))

  return NextResponse.json(rows)
}

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(['admin', 'worker']).default('worker'),
})

export async function POST(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const body = inviteSchema.parse(await req.json())
    const supabaseAdmin = createSupabaseAdminClient()

    // Create/invite the user via Supabase Auth — triggers handle_new_user automatically
    const { data, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
      data: { full_name: body.full_name },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 422 })
    }

    // Add to org
    await db.insert(orgMembers).values({
      org_id: ctx!.orgId,
      user_id: data.user.id,
      role: body.role,
    }).onConflictDoUpdate({
      target: [orgMembers.org_id, orgMembers.user_id],
      set: { deleted_at: null, role: body.role },
    })

    return NextResponse.json({ id: data.user.id, full_name: body.full_name, role: body.role }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}
