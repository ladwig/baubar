import type { WhatsAppProvider, NormalizedMessage, NormalizedStatus, ProvisionedNumber } from './types'

/**
 * Meta Cloud API provider — STUB.
 *
 * TODO when implementing:
 *  - Use META_ACCESS_TOKEN + META_PHONE_NUMBER_ID env vars
 *  - provisionNumber: POST /phone_numbers with OTP verification flow
 *  - verifySignature: X-Hub-Signature-256 (HMAC-SHA256 of raw body with app secret)
 *  - parseWebhook: map Meta webhook entry → NormalizedMessage
 *  - downloadMedia: GET /{media-id} → redirect to CDN URL, then fetch with Bearer token
 *  - Webhook GET route: handle Meta verification challenge (hub.challenge)
 */
export class MetaProvider implements WhatsAppProvider {
  async provisionNumber(_phone: string, _name: string): Promise<ProvisionedNumber> {
    throw new Error('MetaProvider not implemented')
  }
  async deprovisionNumber(_id: string): Promise<void> {
    throw new Error('MetaProvider not implemented')
  }
  async sendText(_from: string, _to: string, _text: string): Promise<string> {
    throw new Error('MetaProvider not implemented')
  }
  async sendMedia(_from: string, _to: string, _url: string, _caption?: string): Promise<string> {
    throw new Error('MetaProvider not implemented')
  }
  async sendTypingIndicator(_incomingMessageSid: string, _from: string, _to: string): Promise<void> {
    throw new Error('MetaProvider not implemented')
  }
  parseWebhook(_body: string, _headers: Record<string, string>): NormalizedMessage {
    throw new Error('MetaProvider not implemented')
  }
  verifySignature(_body: string, _headers: Record<string, string>): boolean {
    throw new Error('MetaProvider not implemented')
  }
  async downloadMedia(_id: string): Promise<{ data: Buffer; mimeType: string }> {
    throw new Error('MetaProvider not implemented')
  }
  parseStatus(_body: string): NormalizedStatus {
    throw new Error('MetaProvider not implemented')
  }
  async markAsRead(_msgId: string, _from: string): Promise<void> {
    throw new Error('MetaProvider not implemented')
  }
}
