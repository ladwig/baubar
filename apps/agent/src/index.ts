import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { streamText, generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { buildTools, buildToolsWithContext, buildSystemPrompt } from '@baubar/ai'
import { whatsappChannel } from './channels/whatsapp'
import { AuthError, resolveOrgContext } from './lib/auth'
import { getOrCreateThread, loadHistory, loadDisplayHistory, persistTurn, createFreshThread, verifyThreadOwnership, loadOrgConfig } from '@baubar/ai'
import { checkRateLimit } from './lib/rate-limit'

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY })
const _groq = createGroq({ apiKey: process.env.GROQ_API_KEY }) // kept as fallback
const model = google('gemini-2.5-flash')

const app = new Hono()

app.use('*', cors({
  origin: process.env.WEB_API_BASE ?? 'http://localhost:3000',
  allowHeaders: ['Authorization', 'Content-Type'],
}))

// ---------------------------------------------------------------------------
// Web / mobile channel — streaming SSE (Vercel AI SDK data stream protocol)
// ---------------------------------------------------------------------------

/** GET /chat — return message history for the current user's thread */
app.get('/chat', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) return c.json({ error: 'Unauthorized' }, 401)

    const ctx = await resolveOrgContext(token)
    const requestedThreadId = c.req.query('threadId')

    let threadId: string
    if (requestedThreadId) {
      const valid = await verifyThreadOwnership(requestedThreadId, ctx.orgId)
      if (!valid) return c.json({ error: 'Not found' }, 404)
      threadId = requestedThreadId
    } else {
      threadId = await getOrCreateThread(ctx.orgId, 'web', ctx.userId)
    }

    const history = await loadDisplayHistory(threadId)
    return c.json({ threadId, messages: history })
  } catch (err) {
    if (err instanceof AuthError) return c.json({ error: err.message }, 401)
    console.error('[GET /chat]', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/** POST /thread — create a fresh thread, returns { threadId } */
app.post('/thread', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) return c.json({ error: 'Unauthorized' }, 401)

    const ctx = await resolveOrgContext(token)
    const threadId = await createFreshThread(ctx.orgId, 'web', ctx.userId)
    return c.json({ threadId })
  } catch (err) {
    if (err instanceof AuthError) return c.json({ error: err.message }, 401)
    console.error('[POST /thread]', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

app.post('/chat', async (c) => {
  console.log('[/chat] incoming')
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) return c.json({ error: 'Unauthorized' }, 401)

    const ctx = await resolveOrgContext(token)

    const { allowed, retryAfterMs } = checkRateLimit(ctx.userId)
    if (!allowed) {
      return c.json(
        { error: 'Too many requests', retryAfterSeconds: Math.ceil(retryAfterMs / 1000) },
        429,
      )
    }

    // useChat sends { messages: CoreMessage[], threadId?: string } — read body once
    const { messages: clientMessages, threadId: requestedThreadId } = await c.req.json()
    const lastUserMessage: string = clientMessages?.at(-1)?.content ?? ''

    let threadId: string
    if (requestedThreadId) {
      const valid = await verifyThreadOwnership(requestedThreadId, ctx.orgId)
      threadId = valid ? requestedThreadId : await getOrCreateThread(ctx.orgId, 'web', ctx.userId)
    } else {
      threadId = await getOrCreateThread(ctx.orgId, 'web', ctx.userId)
    }

    const [history, orgPrompt] = await Promise.all([
      loadHistory(threadId),
      loadOrgConfig(ctx.orgId),
    ])

    const result = streamText({
      model,
      system: buildSystemPrompt(orgPrompt),
      messages: [
        ...history,
        { role: 'user' as const, content: lastUserMessage },
      ] as Parameters<typeof streamText>[0]['messages'],
      tools: buildTools({ ...ctx, apiBase: process.env.WEB_API_BASE! }),
      maxSteps: 5,
      onError: (err) => {
        console.error('[/chat] streamText error:', err)
      },
      onFinish: async ({ response }) => {
        try {
          await persistTurn(threadId, lastUserMessage, response.messages)
        } catch (err) {
          console.error('[/chat] persistTurn error:', err)
        }
      },
    })

    return result.toDataStreamResponse()
  } catch (err) {
    if (err instanceof AuthError) return c.json({ error: err.message }, 401)
    console.error('[/chat]', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Internal API — called by Gateway service to process a WhatsApp message
// ---------------------------------------------------------------------------
app.post('/internal/process', async (c) => {
  const apiKey = c.req.header('X-Api-Key')
  if (!apiKey || apiKey !== process.env.GATEWAY_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { orgId, threadId, message, mediaTempPaths = [], pendingContext } = await c.req.json<{
    orgId:            string
    threadId:         string
    message:          string
    mediaTempPaths?:  string[]
    pendingContext?:  Record<string, unknown> | null
  }>()

  try {
    const [history, orgPrompt] = await Promise.all([
      loadHistory(threadId),
      loadOrgConfig(orgId),
    ])

    const ctx = {
      token:    process.env.AGENT_SECRET!,
      apiBase:  process.env.WEB_API_BASE!,
      orgId,
      userId:   'gateway',
      threadId,
    }

    // Build user content: append media paths and/or pending context so the
    // LLM has all relevant information in a single message.
    const parts: string[] = [message]
    if (mediaTempPaths.length > 0) {
      parts.push(`[${mediaTempPaths.length} Bild(er) hochgeladen: ${mediaTempPaths.join(', ')}]`)
    }
    if (pendingContext) {
      parts.push(`[Pending context from previous turn: ${JSON.stringify(pendingContext)}]`)
    }
    const userContent = parts.join('\n\n')

    const { tools, getPendingContext } = buildToolsWithContext(ctx)

    const result = await generateText({
      model,
      system: buildSystemPrompt(orgPrompt),
      messages: [
        ...history,
        { role: 'user' as const, content: userContent },
      ] as Parameters<typeof streamText>[0]['messages'],
      tools,
      maxSteps: 5,
    })

    await persistTurn(threadId, userContent, result.response.messages)
    return c.json({ text: result.text, pendingContext: getPendingContext() })
  } catch (err) {
    console.error('[/internal/process]', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// WhatsApp webhook — async (provider calls this, we reply via Gateway)
// Meta requires a GET handler for the initial webhook verification challenge.
// ---------------------------------------------------------------------------
app.get('/webhooks/whatsapp', (c) => {
  // TODO: implement Meta webhook verification challenge
  return c.text('Not implemented', 501)
})

app.post('/webhooks/whatsapp', async (c) => {
  // TODO: verify signature → parse message → publish to ai.queue for async processing
  // Always return 200 immediately so the provider doesn't retry
  void whatsappChannel.parse(c).catch((err) => console.error('[/webhooks/whatsapp]', err))
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/health', (c) => c.json({ ok: true }))

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Agent service running on http://localhost:${port}`)
})
