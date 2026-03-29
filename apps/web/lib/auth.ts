import { headers } from 'next/headers'
import { eq, and, isNull } from 'drizzle-orm'
import { db, orgMembers } from '@baubar/db'
import { createSupabaseServerClient } from './supabase/server'

export async function getOrgContext() {
  const headersList = headers()

  // Service-to-service auth: gateway uses GATEWAY_SECRET as Bearer token + X-Org-Id header
  const authHeader = headersList.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  const gatewaySecret = process.env.AGENT_SECRET
  if (gatewaySecret && bearerToken === gatewaySecret) {
    const orgId = headersList.get('X-Org-Id')
    if (orgId) {
      // Service calls have no real user — actor_id will be null in audit events
      return {
        user: { id: null } as unknown as { id: string },
        orgId,
        role: 'service' as string,
      }
    }
  }

  const supabase = createSupabaseServerClient()

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
