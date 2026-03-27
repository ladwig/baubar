import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

// ---------------------------------------------------------------------------
// Provider webhooks (inbound from Twilio / Meta)
// ---------------------------------------------------------------------------
app.post('/webhooks/twilio', (c) => {
  // TODO: TwilioProvider.verifySignature → parseWebhook → mirror media
  //       → persist to gateway.messages → publish to ai.queue
  return c.text('Not implemented', 501)
})

app.get('/webhooks/meta', (c) => {
  // TODO: respond to Meta webhook verification challenge
  // hub.mode=subscribe, hub.verify_token, hub.challenge
  return c.text('Not implemented', 501)
})

app.post('/webhooks/meta', (c) => {
  // TODO: MetaProvider.verifySignature → parseWebhook → mirror media
  //       → persist to gateway.messages → publish to ai.queue
  return c.text('Not implemented', 501)
})

// ---------------------------------------------------------------------------
// Outbound — called by Agent Service to send a reply via WhatsApp
// ---------------------------------------------------------------------------
app.post('/messages/send', (c) => {
  // TODO: look up company_number → select provider → call provider.sendText/sendMedia
  return c.text('Not implemented', 501)
})

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/health', (c) => c.json({ ok: true }))

const port = Number(process.env.PORT ?? 3002)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Gateway service running on http://localhost:${port}`)
})
