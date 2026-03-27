import { generateText, type LanguageModel } from 'ai'
import { buildTools } from './tools/index'
import type { InboundMessage, OrgContext, ThreadMessage } from './types'

const SYSTEM_PROMPT = `You are Baubar Assistant, an AI helper for construction project management.
You have access to the organisation's projects, reports, companies, and contacts.
Always respond in the same language the user writes in.
When creating reports or updating data, confirm what you did concisely.
Never make up project names, IDs, or data — use the provided tools to look things up.`

/**
 * Core agent runner. Completely channel-agnostic.
 *
 * The caller (apps/agent router) is responsible for:
 *   1. Loading the thread history from the DB
 *   2. Passing the correct LanguageModel (configured with provider + model name)
 *   3. Persisting the new user message and returned assistant message afterwards
 *
 * @returns The assistant's final text response
 */
export async function runAgent(opts: {
  model: LanguageModel
  history: ThreadMessage[]
  message: InboundMessage
  ctx: OrgContext
}): Promise<string> {
  const messages: ThreadMessage[] = [
    ...opts.history,
    { role: 'user', content: opts.message.content },
  ]

  const { text } = await generateText({
    model: opts.model,
    system: SYSTEM_PROMPT,
    // generateText accepts CoreMessage[] — ThreadMessage is compatible
    messages: messages as Parameters<typeof generateText>[0]['messages'],
    tools: buildTools(opts.ctx),
    maxSteps: 5,
  })

  return text
}
