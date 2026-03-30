import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { and, eq, isNull } from 'drizzle-orm'
import { db, gatewayOrgNumbers, gatewayAllowedContacts } from '@baubar/db'
import { createClient } from '@supabase/supabase-js'
import { TwilioProvider } from './providers/twilio'
import {
  findOrgNumber,
  isContactAllowed,
  findOrCreateConversation,
  getOrCreateThreadForConversation,
  saveMessage,
  markDelivered,
  markFailed,
  popPendingContext,
  setPendingContext,
} from './store'
import { resolveUserId, processWithAgent } from './processor'
import { transcribeAudio } from './transcribe'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
)

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Download media from Twilio and upload to Supabase Storage temp folder.
 * Returns the storage path, or null if the mime type is not supported.
 */
async function uploadMediaToTemp(orgId: string, mediaUrl: string, mimeType: string | null): Promise<string | null> {
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    console.warn(`[media] unsupported mime type: ${mimeType}`)
    return null
  }

  const { data, mimeType: downloadedMime } = await twilio.downloadMedia(mediaUrl)
  const ext = (downloadedMime ?? mimeType).split('/')[1] ?? 'jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const storagePath = `${orgId}/temp/${filename}`

  const { error } = await supabase.storage
    .from('report-images')
    .upload(storagePath, data, { contentType: downloadedMime ?? mimeType, upsert: false })

  if (error) {
    console.error('[media] storage upload error:', error)
    return null
  }

  return storagePath
}

const app = new Hono()
const twilio = new TwilioProvider()

// ---------------------------------------------------------------------------
// Auth middleware for internal API routes
// ---------------------------------------------------------------------------
app.use('/api/*', async (c, next) => {
  const apiKey = c.req.header('X-Api-Key')
  if (!apiKey || apiKey !== process.env.GATEWAY_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return next()
})

// ---------------------------------------------------------------------------
// Twilio inbound webhook
// Twilio expects 200 OK immediately — processing is async
// ---------------------------------------------------------------------------
app.post('/webhooks/twilio', async (c) => {
  const rawBody = await c.req.text()

  // Verify Twilio signature (skip in dev if TWILIO_WEBHOOK_URL not set)
  if (process.env.TWILIO_WEBHOOK_URL) {
    const headers = Object.fromEntries(c.req.raw.headers.entries())
    if (!twilio.verifySignature(rawBody, headers)) {
      console.warn('[webhook] Invalid Twilio signature')
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  const params = new URLSearchParams(rawBody)

  // Status callback (delivered / read / failed)
  if (params.has('MessageStatus')) {
    void handleStatusCallback(params).catch((err) =>
      console.error('[webhook] status callback error:', err)
    )
    return c.json({ ok: true })
  }

  // Inbound message — fire and forget, return 200 immediately
  void handleInbound(rawBody).catch((err) =>
    console.error('[webhook] inbound processing error:', err)
  )

  return c.json({ ok: true })
})

async function handleStatusCallback(params: URLSearchParams) {
  const sid    = params.get('MessageSid') ?? ''
  const status = params.get('MessageStatus') ?? ''
  if (status === 'delivered') {
    await markDelivered(sid)
  } else if (status === 'failed' || status === 'undelivered') {
    await markFailed(sid, params.get('ErrorCode'))
  }
}

const id8 = (uuid: string) => uuid.slice(0, 8)

async function handleInbound(rawBody: string) {
  const msg = twilio.parseWebhook(rawBody, {})

  // 1. Find org by destination number
  const orgNumber = await findOrgNumber(msg.to)
  if (!orgNumber) {
    console.warn(`[gateway] unknown number ${msg.to}`)
    return
  }

  const org = id8(orgNumber.org_id)

  // 2. Whitelist check
  const allowed = await isContactAllowed(orgNumber.org_id, msg.from)
  if (!allowed) {
    console.warn(`[gateway] org=${org} ${msg.from} not whitelisted`)
    return
  }

  // 3. Find or create conversation + AI thread
  const conversation = await findOrCreateConversation(orgNumber.org_id, orgNumber.id, msg.from)
  const threadId     = await getOrCreateThreadForConversation(orgNumber.org_id, conversation.id, msg.from)
  const pendingContext = await popPendingContext(conversation.id)

  console.info(`[gateway] org=${org} from=${msg.from} type=${msg.type} conv=${id8(conversation.id)} thread=${id8(threadId)}${pendingContext ? ' +ctx' : ''}`)

  // 4. Skip unsupported message types early (documents, location, stickers: v2)
  if (msg.type !== 'text' && msg.type !== 'image' && msg.type !== 'audio') {
    console.info(`[gateway] skipping unsupported type "${msg.type}"`)
    return
  }
  if (msg.type === 'text' && !msg.content.trim()) return

  // 5. Process media before persisting so we can store the transcription as content
  const mediaTempPaths: string[] = []
  let messageContent = msg.content
  let audioStoragePath: string | undefined

  if (msg.type === 'image') {
    for (const mediaUrl of msg.mediaUrls) {
      const path = await uploadMediaToTemp(orgNumber.org_id, mediaUrl, msg.mimeType)
      if (path) mediaTempPaths.push(path)
    }
    if (mediaTempPaths.length) console.info(`[gateway] org=${org} images uploaded: ${mediaTempPaths.length}`)
  }

  if (msg.type === 'audio' && msg.mediaUrls[0]) {
    const { data, mimeType: downloadedMime } = await twilio.downloadMedia(msg.mediaUrls[0])
    const mime = downloadedMime ?? msg.mimeType ?? 'audio/ogg'
    const ext = mime.includes('ogg') ? 'ogg' : mime.split('/')[1] ?? 'ogg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    audioStoragePath = `${orgNumber.org_id}/voice/${filename}`

    const { error: uploadError } = await supabase.storage
      .from('voice-messages')
      .upload(audioStoragePath, data, { contentType: 'application/octet-stream', upsert: false })

    if (uploadError) {
      console.warn(`[gateway] org=${org} audio storage failed (non-fatal): ${uploadError.message}`)
      audioStoragePath = undefined
    }

    try {
      const transcription = await transcribeAudio(data, mime)
      messageContent = transcription
      console.info(`[gateway] org=${org} transcribed: "${transcription.slice(0, 80)}"`)
    } catch (err) {
      console.error(`[gateway] org=${org} transcription failed:`, err)
      return
    }
  }

  // 6. Persist inbound message
  await saveMessage(
    conversation.id, 'inbound', msg.from, messageContent, msg.type, msg.providerMessageId,
    audioStoragePath ? { media_storage_url: audioStoragePath, mime_type: msg.mimeType ?? undefined } : undefined,
  )

  const actorId = await resolveUserId(orgNumber.org_id, msg.from)
  void actorId

  // 7. Call agent
  let reply: string
  try {
    const agentMessage = msg.type === 'audio'
      ? `[Sprachnotiz transkribiert]: ${messageContent}`
      : messageContent
    const result = await processWithAgent(orgNumber.org_id, threadId, agentMessage, mediaTempPaths, pendingContext)
    reply = result.text
    if (result.pendingContext !== null) {
      await setPendingContext(conversation.id, result.pendingContext)
      console.info(`[gateway] org=${org} pending context set: ${JSON.stringify(result.pendingContext)}`)
    }
  } catch (err) {
    console.error(`[gateway] org=${org} agent error:`, err)
    reply = 'Es tut mir leid, ich konnte deine Nachricht gerade nicht verarbeiten. Bitte versuche es später erneut.'
  }

  // 8. Send reply
  let outboundSid: string | undefined
  try {
    outboundSid = await twilio.sendText(msg.to, msg.from, reply)
    console.info(`[gateway] org=${id8(orgNumber.org_id)} reply sent to ${msg.from}: "${reply.slice(0, 80)}"`)
  } catch (err) {
    console.error(`[gateway] org=${id8(orgNumber.org_id)} send failed:`, err)
    return
  }

  await saveMessage(conversation.id, 'outbound', msg.to, reply, 'text', outboundSid)
}

// ---------------------------------------------------------------------------
// Outbound API — called by PM system / other services to send a message
// ---------------------------------------------------------------------------
app.post('/api/v1/messages/send', async (c) => {
  const body = await c.req.json<{ org_id: string; to_phone: string; body: string }>()

  if (!body.org_id || !body.to_phone || !body.body) {
    return c.json({ error: 'org_id, to_phone and body are required' }, 400)
  }

  const [orgNumber] = await db
    .select()
    .from(gatewayOrgNumbers)
    .where(and(eq(gatewayOrgNumbers.org_id, body.org_id), isNull(gatewayOrgNumbers.deactivated_at)))
    .limit(1)

  if (!orgNumber) {
    return c.json({ error: 'No active number for this org' }, 404)
  }

  try {
    const sid          = await twilio.sendText(orgNumber.phone_number, body.to_phone, body.body)
    const conversation = await findOrCreateConversation(body.org_id, orgNumber.id, body.to_phone)
    await saveMessage(conversation.id, 'outbound', orgNumber.phone_number, body.body, 'text', sid)
    return c.json({ ok: true, sid })
  } catch (err) {
    console.error('[/api/v1/messages/send]', err)
    return c.json({ error: 'Failed to send message' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Allowed contacts management API (no UI yet — used via API / scripts)
// ---------------------------------------------------------------------------
app.get('/api/v1/allowed-contacts', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'org_id required' }, 400)

  const rows = await db
    .select()
    .from(gatewayAllowedContacts)
    .where(eq(gatewayAllowedContacts.org_id, orgId))
  return c.json(rows)
})

app.post('/api/v1/allowed-contacts', async (c) => {
  const { org_id, contact_phone, contact_id, created_by } = await c.req.json<{
    org_id:        string
    contact_phone: string
    contact_id?:   string
    created_by?:   string
  }>()

  if (!org_id || !contact_phone) {
    return c.json({ error: 'org_id and contact_phone are required' }, 400)
  }

  const [row] = await db
    .insert(gatewayAllowedContacts)
    .values({ org_id, contact_phone, contact_id, created_by })
    .onConflictDoNothing()
    .returning()

  return c.json(row ?? { error: 'Already exists' }, row ? 201 : 409)
})

app.delete('/api/v1/allowed-contacts/:id', async (c) => {
  await db
    .delete(gatewayAllowedContacts)
    .where(eq(gatewayAllowedContacts.id, c.req.param('id')))
  return new Response(null, { status: 204 })
})

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/health', (c) => c.json({ ok: true }))

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const port = Number(process.env.PORT ?? 3002)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Gateway service running on http://localhost:${port}`)
})
