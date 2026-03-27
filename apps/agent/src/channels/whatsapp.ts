import type { Context } from 'hono'
import type { ChannelAdapter } from './types'
import type { InboundMessage } from '@baubar/ai'

/**
 * WhatsApp channel adapter — STUB.
 *
 * TODO when implementing:
 *  1. parse(): verify webhook signature (X-Twilio-Signature or X-Hub-Signature-256)
 *  2. parse(): translate provider payload → InboundMessage
 *              mirror media to Supabase Storage before returning
 *  3. parse(): resolve orgId via gateway.company_numbers (phone → org)
 *  4. reply(): call Gateway Service POST /messages/send
 */
export const whatsappChannel: ChannelAdapter = {
  async parse(_c: Context): Promise<InboundMessage> {
    throw new Error('WhatsApp channel not yet implemented')
  },

  async reply(_threadId: string, _text: string, _c: Context): Promise<void> {
    throw new Error('WhatsApp channel not yet implemented')
  },
}
