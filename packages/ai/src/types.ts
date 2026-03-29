/**
 * Auth context passed to every tool executor call.
 * The agent service obtains this from the incoming request
 * and threads it through so tools can call the web API on behalf of the user.
 */
export type OrgContext = {
  /** Bearer token forwarded from the original request */
  token: string
  /** Base URL of apps/web — e.g. http://localhost:3000 in dev, https://app.baubar.de in prod */
  apiBase: string
  orgId: string
  userId: string
  /** AI thread ID — required for set_pending_context on WhatsApp channel */
  threadId?: string
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/** All supported channels. Adding a new one here is the only place it needs
 *  to be registered — TypeScript will then enforce it everywhere. */
export type Channel = 'web' | 'whatsapp' | 'mobile'

// ---------------------------------------------------------------------------
// Normalised message format (channel-agnostic)
// ---------------------------------------------------------------------------

export type TextPart = { type: 'text'; text: string }
export type ImagePart = {
  type: 'image'
  /** base64-encoded image data */
  data: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
}
export type MessageContentPart = TextPart | ImagePart

/**
 * A message coming IN to the agent, after normalisation by a channel adapter.
 * Channel adapters translate their native format (WhatsApp webhook payload,
 * HTTP JSON body, etc.) into this shape before handing off to the router.
 */
export type InboundMessage = {
  channel: Channel
  /** Stable identifier for the sender within the channel.
   *  web/mobile: user UUID — whatsapp: phone number in E.164 */
  senderId: string
  orgId: string
  /** Conversation thread this message belongs to */
  threadId: string
  content: MessageContentPart[]
}

// ---------------------------------------------------------------------------
// Thread / conversation history
// ---------------------------------------------------------------------------

/** A single turn stored in the thread, in the shape expected by the Vercel AI SDK. */
export type ThreadMessage = {
  role: 'user' | 'assistant' | 'tool'
  content: string | MessageContentPart[] | unknown[]
}
