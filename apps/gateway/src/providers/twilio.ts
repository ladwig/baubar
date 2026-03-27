import type { WhatsAppProvider, NormalizedMessage, NormalizedStatus, ProvisionedNumber } from './types'

/**
 * Twilio WhatsApp provider — STUB.
 *
 * TODO when implementing:
 *  - npm install twilio
 *  - Use TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN env vars
 *  - provisionNumber: IncomingPhoneNumbers.create() + WhatsApp Sender registration
 *  - verifySignature: validateRequest() from twilio library
 *  - parseWebhook: map Twilio MessagingWebhook body → NormalizedMessage
 *  - downloadMedia: fetch with Basic Auth (SID:token)
 */
export class TwilioProvider implements WhatsAppProvider {
  async provisionNumber(_phone: string, _name: string): Promise<ProvisionedNumber> {
    throw new Error('TwilioProvider not implemented')
  }
  async deprovisionNumber(_id: string): Promise<void> {
    throw new Error('TwilioProvider not implemented')
  }
  async sendText(_from: string, _to: string, _text: string): Promise<string> {
    throw new Error('TwilioProvider not implemented')
  }
  async sendMedia(_from: string, _to: string, _url: string, _caption?: string): Promise<string> {
    throw new Error('TwilioProvider not implemented')
  }
  async sendTypingIndicator(_from: string, _to: string): Promise<void> {
    throw new Error('TwilioProvider not implemented')
  }
  parseWebhook(_body: string, _headers: Record<string, string>): NormalizedMessage {
    throw new Error('TwilioProvider not implemented')
  }
  verifySignature(_body: string, _headers: Record<string, string>): boolean {
    throw new Error('TwilioProvider not implemented')
  }
  async downloadMedia(_id: string): Promise<{ data: Buffer; mimeType: string }> {
    throw new Error('TwilioProvider not implemented')
  }
  parseStatus(_body: string): NormalizedStatus {
    throw new Error('TwilioProvider not implemented')
  }
  async markAsRead(_msgId: string, _from: string): Promise<void> {
    throw new Error('TwilioProvider not implemented')
  }
}
