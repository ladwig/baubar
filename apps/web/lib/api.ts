import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getOrgContext } from './auth'

export async function requireOrgContext() {
  const ctx = await getOrgContext()
  if (!ctx.user || !ctx.orgId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), ctx: null }
  }
  return { error: null, ctx: ctx as { user: NonNullable<typeof ctx.user>; orgId: string; role: string | null } }
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.flatten() }, { status: 422 })
  }
  if (err instanceof Error && err.message === 'Report not found') {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }
  console.error(err)
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}
