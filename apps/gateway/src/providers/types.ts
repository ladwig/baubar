/**
 * Provider abstraction layer.
 * Twilio and Meta both implement this interface.
 * The rest of the Gateway never imports provider-specific code directly.
 */
export interface WhatsAppProvider {
  /** Buy / register a number and configure the webhook URL at the provider. */
  provisionNumber(phoneNumber: string, displayName: string): Promise<ProvisionedNumber>
  deprovisionNumber(providerNumberId: string): Promise<void>

  /** Outbound messages */
  sendText(from: string, to: string, text: string): Promise<string>
  sendMedia(from: string, to: string, mediaUrl: string, caption?: string): Promise<string>
  sendTypingIndicator(incomingMessageSid: string, from: string, to: string): Promise<void>

  /** Inbound — called by the webhook route after signature verification */
  parseWebhook(rawBody: string, headers: Record<string, string>): NormalizedMessage
  verifySignature(rawBody: string, headers: Record<string, string>): boolean

  /** Download provider-hosted media and return the buffer */
  downloadMedia(providerMediaId: string): Promise<{ data: Buffer; mimeType: string }>

  /** Status updates (delivered / read / failed) */
  parseStatus(rawBody: string): NormalizedStatus
  markAsRead(providerMessageId: string, from: string): Promise<void>
}

export type ProvisionedNumber = {
  providerNumberId: string
  phoneNumber: string
}

export type NormalizedMessage = {
  provider:           'twilio' | 'meta'
  orgId:              string
  orgNumberId:        string  // FK → gateway.company_numbers.id
  from:               string
  to:                 string
  isGroup:            boolean
  groupId:            string | null
  messageId:          string
  providerMessageId:  string
  timestamp:          Date
  type:               'text' | 'image' | 'audio' | 'document' | 'location'
  content:            string        // text body (empty string for image-only messages)
  mediaUrls:          string[]      // provider-hosted media URLs (may require auth to download)
  mimeType:           string | null // mime type of the first media item
  raw:                unknown
}

export type NormalizedStatus = {
  providerMessageId:  string
  status:             'delivered' | 'read' | 'failed'
  timestamp:          Date
  errorCode:          string | null
}
