import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, users } from '@baubar/db'
import { requireOrgContext, handleError } from '@/lib/api'

const updateProfileSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (+491234567890)').nullable().optional(),
})

export async function GET() {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  const [user] = await db
    .select({ id: users.id, full_name: users.full_name, avatar_url: users.avatar_url, phone: users.phone })
    .from(users)
    .where(eq(users.id, ctx!.user.id))
    .limit(1)

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest) {
  const { error, ctx } = await requireOrgContext()
  if (error) return error

  try {
    const data = updateProfileSchema.parse(await req.json())
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, ctx!.user.id))
      .returning()
    return NextResponse.json(user)
  } catch (err) {
    return handleError(err)
  }
}
