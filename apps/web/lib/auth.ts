import { headers } from 'next/headers'
import { eq, and, isNull } from 'drizzle-orm'
import { db, orgMembers } from '@baubar/db'
import { createSupabaseServerClient } from './supabase/server'

export async function getOrgContext() {
  const supabase = createSupabaseServerClient()

  // Support both cookie-based auth (browser) and Bearer token auth (agent service tools)
  const authHeader = headers().get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  const {
    data: { user },
  } = await supabase.auth.getUser(bearerToken)

  if (!user) return { user: null, orgId: null, role: null }

  // Use Drizzle (direct DB) — project_management schema is not exposed via PostgREST
  const [membership] = await db
    .select({ org_id: orgMembers.org_id, role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.user_id, user.id), isNull(orgMembers.deleted_at)))
    .limit(1)

  return {
    user,
    orgId: membership?.org_id ?? null,
    role: membership?.role ?? null,
  }
}
