import { db, gatewayOrgNumbers, gatewayAllowedContacts, gatewayConversations, gatewayMessages, aiThreads } from '@baubar/db'
import { eq, and, isNull } from 'drizzle-orm'

/** Find the org number record for an inbound "To" phone number. */
export async function findOrgNumber(phone: string) {
  const [row] = await db
    .select()
    .from(gatewayOrgNumbers)
    .where(and(eq(gatewayOrgNumbers.phone_number, phone), isNull(gatewayOrgNumbers.deactivated_at)))
    .limit(1)
  return row ?? null
}

/** Check if a contact is on the whitelist for the given org. */
export async function isContactAllowed(orgId: string, phone: string): Promise<boolean> {
  const [row] = await db
    .select({ id: gatewayAllowedContacts.id })
    .from(gatewayAllowedContacts)
    .where(and(
      eq(gatewayAllowedContacts.org_id, orgId),
      eq(gatewayAllowedContacts.contact_phone, phone),
    ))
    .limit(1)
  return !!row
}

/** Find or create a direct conversation between org number and contact phone. */
export async function findOrCreateConversation(orgId: string, orgNumberId: string, contactPhone: string) {
  const [existing] = await db
    .select()
    .from(gatewayConversations)
    .where(and(
      eq(gatewayConversations.org_id, orgId),
      eq(gatewayConversations.org_number_id, orgNumberId),
      eq(gatewayConversations.contact_phone, contactPhone),
      isNull(gatewayConversations.deactivated_at),
    ))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(gatewayConversations)
    .values({ org_id: orgId, org_number_id: orgNumberId, contact_phone: contactPhone, type: 'direct' })
    .returning()
  return created!
}

/**
 * Find the AI thread for a conversation, or create one and link it.
 * Returns the thread ID.
 */
export async function getOrCreateThreadForConversation(
  orgId: string,
  conversationId: string,
  contactPhone: string,
): Promise<string> {
  const [conv] = await db
    .select({ thread_id: gatewayConversations.thread_id })
    .from(gatewayConversations)
    .where(eq(gatewayConversations.id, conversationId))
    .limit(1)

  if (conv?.thread_id) return conv.thread_id

  const [thread] = await db
    .insert(aiThreads)
    .values({ org_id: orgId, channel: 'whatsapp', external_id: contactPhone })
    .returning({ id: aiThreads.id })

  await db
    .update(gatewayConversations)
    .set({ thread_id: thread!.id })
    .where(eq(gatewayConversations.id, conversationId))

  return thread!.id
}

/** Persist a message and update conversation's last_message_at. */
export async function saveMessage(
  conversationId: string,
  direction: 'inbound' | 'outbound',
  fromNumber: string,
  content: string,
  type: string = 'text',
  providerMessageId?: string,
) {
  const [msg] = await db
    .insert(gatewayMessages)
    .values({ conversation_id: conversationId, direction, from_number: fromNumber, type, content, provider_message_id: providerMessageId })
    .returning()

  await db
    .update(gatewayConversations)
    .set({ last_message_at: new Date() })
    .where(eq(gatewayConversations.id, conversationId))

  return msg!
}

/** Mark a message as delivered by provider_message_id. */
export async function markDelivered(providerMessageId: string) {
  await db
    .update(gatewayMessages)
    .set({ delivered_at: new Date() })
    .where(eq(gatewayMessages.provider_message_id, providerMessageId))
}

/** Mark a message as failed. */
export async function markFailed(providerMessageId: string, errorCode?: string | null) {
  await db
    .update(gatewayMessages)
    .set({ failed_at: new Date(), error_code: errorCode ?? null })
    .where(eq(gatewayMessages.provider_message_id, providerMessageId))
}
