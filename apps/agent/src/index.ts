import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { ZodError } from 'zod'
import { handleIncoming } from './router'
import { webChannel } from './channels/web'
import { whatsappChannel } from './channels/whatsapp'
import { AuthError } from './lib/auth'

const app = new Hono()

app.use('*', cors({
  origin: process.env.WEB_API_BASE ?? 'http://localhost:3000',
  allowHeaders: ['Authorization', 'Content-Type'],
}))

// ---------------------------------------------------------------------------
// Web / mobile channel — synchronous request/response
// ---------------------------------------------------------------------------
app.post('/chat', async (c) => {
  try {
    const text = await handleIncoming(webChannel, c)
    return c.json({ reply: text })
  } catch (err) {
    if (err instanceof AuthError) return c.json({ error: err.message }, 401)
    if (err instanceof ZodError) return c.json({ error: err.flatten() }, 422)
    console.error('[/chat]', err)
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
  try {
    await handleIncoming(whatsappChannel, c)
    return c.json({ ok: true }) // provider expects 200 quickly
  } catch (err) {
    console.error('[/webhooks/whatsapp]', err)
    // Always return 200 to the provider — errors go to our logs, not retried
    return c.json({ ok: true })
  }
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
