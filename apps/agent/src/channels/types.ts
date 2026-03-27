import type { Context } from 'hono'
import type { InboundMessage } from '@baubar/ai'

/**
 * Every channel adapter implements this interface.
 *
 * parse()  — translate the raw HTTP request into a channel-agnostic InboundMessage.
 *            Throws if the request is invalid or authentication fails.
 *
 * reply()  — send the agent's response back via the channel.
 *            For synchronous channels (web, mobile) this is a no-op because
 *            the response is returned directly from the HTTP handler.
 *            For async channels (WhatsApp) this calls the provider send API.
 */
export interface ChannelAdapter {
  parse(c: Context): Promise<InboundMessage>
  reply(threadId: string, text: string, c: Context): Promise<void>
}
