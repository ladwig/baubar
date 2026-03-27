import { db, aiThreads, aiMessages } from '@baubar/db'
import { eq, asc, and } from 'drizzle-orm'
import type { Channel, ThreadMessage } from '@baubar/ai'

const HISTORY_LIMIT = 40 // rolling window — last N messages sent to LLM

/**
 * Find or create a thread for (orgId, channel, externalId).
 * externalId is the user UUID for web/mobile, E.164 phone for WhatsApp.
 */
export async function getOrCreateThread(
  orgId: string,
  channel: Channel,
  externalId: string,
): Promise<string> {
  const existing = await db
    .select({ id: aiThreads.id })
    .from(aiThreads)
    .where(and(
      eq(aiThreads.org_id, orgId),
      eq(aiThreads.channel, channel),
      eq(aiThreads.external_id, externalId),
    ))
    .limit(1)

  if (existing[0]) return existing[0].id

  const [created] = await db
    .insert(aiThreads)
    .values({ org_id: orgId, channel, external_id: externalId })
    .returning({ id: aiThreads.id })

  return created!.id
}

/** Load the last N messages for a thread, oldest first. */
export async function loadHistory(threadId: string): Promise<ThreadMessage[]> {
  const rows = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.thread_id, threadId))
    .orderBy(asc(aiMessages.created_at))
    .limit(HISTORY_LIMIT)

  return rows.map((r) => ({
    role: r.role as 'user' | 'assistant',
    content: r.content as ThreadMessage['content'],
  }))
}

/** Persist a user message and the assistant reply in one batch. */
export async function persistTurn(
  threadId: string,
  userContent: ThreadMessage['content'],
  assistantText: string,
): Promise<void> {
  await db.insert(aiMessages).values([
    { thread_id: threadId, role: 'user',      content: userContent },
    { thread_id: threadId, role: 'assistant', content: assistantText },
  ])
}
