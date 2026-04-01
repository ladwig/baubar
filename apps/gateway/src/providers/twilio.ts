import twilio from 'twilio'
import type { WhatsAppProvider, NormalizedMessage, NormalizedStatus, ProvisionedNumber } from './types'

export class TwilioProvider implements WhatsAppProvider {
  private client: ReturnType<typeof twilio>

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    )
  }

  verifySignature(rawBody: string, headers: Record<string, string>): boolean {
    const signature = headers['x-twilio-signature'] ?? ''
    const url = process.env.TWILIO_WEBHOOK_URL!
    const params = Object.fromEntries(new URLSearchParams(rawBody))
    return twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      signature,
      url,
      params,
    )
  }

  parseWebhook(rawBody: string, _headers: Record<string, string>): NormalizedMessage {
    const p = new URLSearchParams(rawBody)

    const from = (p.get('From') ?? '').replace('whatsapp:', '')
    const to   = (p.get('To')   ?? '').replace('whatsapp:', '')
    const body = p.get('Body') ?? ''
    const sid  = p.get('MessageSid') ?? ''
    const numMedia = parseInt(p.get('NumMedia') ?? '0', 10)

    const mediaUrls: string[] = []
    for (let i = 0; i < numMedia; i++) {
      const url = p.get(`MediaUrl${i}`)
      if (url) mediaUrls.push(url)
    }
    const mimeType = numMedia > 0 ? (p.get('MediaContentType0') ?? null) : null

    return {
      provider:          'twilio',
      orgId:             '',       // filled in by caller after DB lookup
      orgNumberId:       '',       // filled in by caller
      from,
      to,
      isGroup:           false,    // WhatsApp groups via Twilio: v2
      groupId:           null,
      messageId:         sid,
      providerMessageId: sid,
      timestamp:         new Date(),
      type:              mimeType?.startsWith('audio/') ? 'audio'
                       : mimeType?.startsWith('image/') ? 'image'
                       : mediaUrls.length > 0           ? 'image'  // fallback for unknown media
                       : 'text',
      content:           body,
      mediaUrls,
      mimeType,
      raw:               Object.fromEntries(p),
    }
  }

  parseStatus(rawBody: string): NormalizedStatus {
    const p = new URLSearchParams(rawBody)
    const statusRaw = p.get('MessageStatus') ?? ''
    const statusMap: Record<string, NormalizedStatus['status']> = {
      delivered: 'delivered',
      read:      'read',
      failed:    'failed',
      undelivered: 'failed',
    }
    return {
      providerMessageId: p.get('MessageSid') ?? '',
      status:            statusMap[statusRaw] ?? 'failed',
      timestamp:         new Date(),
      errorCode:         p.get('ErrorCode') ?? null,
    }
  }

  async sendText(from: string, to: string, text: string): Promise<string> {
    const msg = await this.client.messages.create({
      from: `whatsapp:${from}`,
      to:   `whatsapp:${to}`,
      body: text,
    })
    return msg.sid
  }

  async sendMedia(from: string, to: string, mediaUrl: string, caption?: string): Promise<string> {
    const msg = await this.client.messages.create({
      from:     `whatsapp:${from}`,
      to:       `whatsapp:${to}`,
      body:     caption ?? '',
      mediaUrl: [mediaUrl],
    })
    return msg.sid
  }

  async sendTypingIndicator(incomingMessageSid: string, _from: string, _to: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken  = process.env.TWILIO_AUTH_TOKEN!

    const res = await fetch('https://messaging.twilio.com/v2/Indicators/Typing.json', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        messageId: incomingMessageSid,
        channel:   'whatsapp',
      }).toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Twilio typing indicator failed (${res.status}): ${text}`)
    }
    // Side effect: automatically marks incomingMessageSid as read in the user's WhatsApp client.
    // Indicator stays visible for 25 s or until the reply is delivered, whichever comes first.
  }

  async downloadMedia(mediaUrl: string): Promise<{ data: Buffer; mimeType: string }> {
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64')}`,
      },
    })
    if (!response.ok) throw new Error(`Failed to download media: ${response.status}`)
    const data = Buffer.from(await response.arrayBuffer())
    const mimeType = response.headers.get('content-type') ?? 'application/octet-stream'
    return { data, mimeType }
  }

  async markAsRead(_msgId: string, _from: string): Promise<void> {
    // Twilio has no standalone mark-as-read API for WhatsApp.
    // Read marking happens automatically as a side effect of sendTypingIndicator().
    // Call that before sending the reply instead.
  }

  async provisionNumber(_phone: string, _name: string): Promise<ProvisionedNumber> {
    // Manual provisioning only for now — numbers are entered in DB directly
    throw new Error('Programmatic provisioning not yet implemented')
  }

  async deprovisionNumber(_id: string): Promise<void> {
    throw new Error('Programmatic deprovisioning not yet implemented')
  }
}
