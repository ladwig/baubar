import { createClient } from '@supabase/supabase-js'
import { db, orgMembers } from '@baubar/db'
import { eq, isNull, and } from 'drizzle-orm'
import type { OrgContext } from '@baubar/ai'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Verify a Supabase JWT and resolve the org context.
 * Throws if the token is invalid or the user has no org membership.
 */
export async function resolveOrgContext(token: string): Promise<OrgContext> {
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new AuthError('Invalid or expired token')

  const [membership] = await db
    .select({ org_id: orgMembers.org_id })
    .from(orgMembers)
    .where(and(eq(orgMembers.user_id, data.user.id), isNull(orgMembers.deleted_at)))
    .limit(1)

  if (!membership) throw new AuthError('No org membership found')

  return {
    token,
    apiBase: process.env.WEB_API_BASE!,
    orgId: membership.org_id,
    userId: data.user.id,
  }
}

export class AuthError extends Error {
  readonly status = 401
}
