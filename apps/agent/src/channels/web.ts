import type { Context } from 'hono'
import { z } from 'zod'
import { resolveOrgContext, AuthError } from '../lib/auth'
import type { ChannelAdapter } from './types'
import type { InboundMessage, MessageContentPart } from '@baubar/ai'

const bodySchema = z.object({
  message: z.string().min(1),
  /** Optional base64-encoded images */
  images: z
    .array(
      z.object({
        data: z.string(),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
      }),
    )
    .optional(),
})

export const webChannel: ChannelAdapter = {
  async parse(c: Context): Promise<InboundMessage> {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) throw new AuthError('Missing Authorization header')

    const ctx = await resolveOrgContext(token)
    const body = bodySchema.parse(await c.req.json())

    const content: MessageContentPart[] = [{ type: 'text', text: body.message }]

    for (const img of body.images ?? []) {
      content.push({ type: 'image', data: img.data, mimeType: img.mimeType })
    }

    return {
      channel: 'web',
      senderId: ctx.userId,
      orgId: ctx.orgId,
      // threadId resolved by router using (orgId, channel, senderId)
      threadId: '',
      content,
    }
  },

  // Web is synchronous — the response goes back as the HTTP reply body.
  // The router handles that directly; nothing to do here.
  async reply(_threadId, _text, _c) {},
}
