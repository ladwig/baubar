import { anthropic } from '@ai-sdk/anthropic'
import { runAgent } from '@baubar/ai'
import { resolveOrgContext, AuthError } from './lib/auth'
import { getOrCreateThread, loadHistory, persistTurn } from './lib/thread-store'
import type { ChannelAdapter } from './channels/types'
import type { Context } from 'hono'

const model = anthropic('claude-opus-4-6')

/**
 * Central dispatch: called by every channel route.
 *
 * 1. Channel adapter parses the raw request → InboundMessage
 * 2. Resolve OrgContext from the token embedded in the message
 * 3. Find or create the conversation thread
 * 4. Load message history
 * 5. Run the agent (LLM + tool loop)
 * 6. Persist the turn
 * 7. Return the response text (channel adapter sends it)
 */
export async function handleIncoming(
  adapter: ChannelAdapter,
  c: Context,
): Promise<string> {
  // 1. Parse
  const message = await adapter.parse(c)

  // 2. Resolve OrgContext — re-use the token extracted by the channel adapter
  const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? ''
  const ctx = await resolveOrgContext(token)

  // 3. Thread
  const threadId = await getOrCreateThread(ctx.orgId, message.channel, message.senderId)
  message.threadId = threadId

  // 4. History
  const history = await loadHistory(threadId)

  // 5. Run agent
  const reply = await runAgent({ model, history, message, ctx })

  // 6. Persist
  await persistTurn(threadId, message.content, reply)

  return reply
}
