import { generateText, type LanguageModel } from 'ai'
import { buildTools } from './tools/index'
import type { InboundMessage, OrgContext, ThreadMessage } from './types'

// Always injected — data safety rules that must never be overridden by org config.
const CONSTRAINTS = `CONSTRAINTS (always apply):
- Never invent names, IDs, or data — always use tools to look things up.
- Tool ID parameters (project_id, company_id, contact_id) must always be the UUID \`id\` field from a list call — never a name or label.
- When the user refers to a project, company, or contact by name, always call the corresponding list tool first to resolve the name to a UUID before proceeding.
- Only call tools when the user explicitly asks for data. Never call tools for greetings, small talk, or anything not requiring real data.
- Always respond in the same language the user writes in.`

// Used when the org has no entry in ai.configs — covers persona, tone, and behaviour.
const DEFAULT_SYSTEM_PROMPT = `You are Baubar Assistant, a concise AI helper for construction project management.

WHEN TO USE TOOLS:
- Only call tools when the user explicitly asks for data (e.g. "zeig mir Projekte", "welche Firmen gibt es", "erstelle einen Bericht").
- When the user asks about the progress or completion of work on a project (e.g. "wurde X fertiggestellt?", "wie weit ist das Projekt?"), always call list_reports and read the content — the status field only reflects administrative state, actual progress is in the reports.

WHEN NOT TO USE TOOLS (answer directly, briefly):
- Greetings: "Hallo", "Wie geht's", "Wer bist du", etc.
- Capability questions: "Was kannst du?", "Wie funktionierst du?"

RESPONSE STYLE:
- Keep answers short — 1–3 sentences for conversational replies.
- When returning data, list only what was asked, no extra commentary.
- When you create or update data, confirm in one sentence.`

/**
 * Build the full system prompt.
 *
 * Structure: CONSTRAINTS + (orgPrompt ?? DEFAULT_SYSTEM_PROMPT)
 *
 * The org prompt fully replaces the default persona/behaviour — the org owns
 * the tone and instructions. Constraints are always prepended and cannot be
 * overridden.
 */
export function buildSystemPrompt(orgPrompt?: string | null): string {
  return `${CONSTRAINTS}\n\n${orgPrompt ?? DEFAULT_SYSTEM_PROMPT}`
}

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
  /** Optional org-specific system prompt from ai.configs */
  customSystemPrompt?: string | null
}): Promise<string> {
  const messages: ThreadMessage[] = [
    ...opts.history,
    { role: 'user', content: opts.message.content },
  ]

  const { text } = await generateText({
    model: opts.model,
    system: buildSystemPrompt(opts.customSystemPrompt),
    // generateText accepts CoreMessage[] — ThreadMessage is compatible
    messages: messages as Parameters<typeof generateText>[0]['messages'],
    tools: buildTools(opts.ctx),
    maxSteps: 5,
  })

  return text
}
