import { and, eq, isNull } from 'drizzle-orm'
import { db, users, orgMembers } from '@baubar/db'

/** Resolve a WhatsApp phone number to a PM user ID within an org. */
export async function resolveUserId(orgId: string, phone: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(orgMembers, eq(orgMembers.user_id, users.id))
    .where(and(eq(users.phone, phone), eq(orgMembers.org_id, orgId), isNull(orgMembers.deleted_at)))
    .limit(1)
  return row?.id ?? null
}

/**
 * Send a WhatsApp message to the agent service for AI processing.
 * Returns the assistant's reply text.
 */
export async function processWithAgent(
  orgId: string,
  threadId: string,
  message: string,
): Promise<string> {
  const res = await fetch(`${process.env.AGENT_API_BASE}/internal/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.GATEWAY_SECRET!,
    },
    body: JSON.stringify({ orgId, threadId, message }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Agent responded ${res.status}: ${text}`)
  }

  const { text } = await res.json()
  return text
}
