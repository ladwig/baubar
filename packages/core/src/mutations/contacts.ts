import { eq, and, isNull } from 'drizzle-orm'
import { db, contacts, customFieldDefinitions } from '@baubar/db'
import type { CustomFieldDefinition } from '@baubar/db'
import { emitEvent } from '../events'
import { buildCustomPropertiesSchema } from '../schemas/custom-fields'
import { createContactSchema, updateContactSchema } from '../schemas/contact.schema'

async function getCustomFieldDefs(orgId: string) {
  return db
    .select()
    .from(customFieldDefinitions)
    .where(
      and(
        eq(customFieldDefinitions.org_id, orgId),
        eq(customFieldDefinitions.entity_type, 'contact'),
        isNull(customFieldDefinitions.deleted_at)
      )
    )
}

export async function createContact(
  actorId: string,
  orgId: string,
  input: unknown,
  customFieldDefs?: CustomFieldDefinition[]
) {
  const defs = customFieldDefs ?? (await getCustomFieldDefs(orgId))
  const data = createContactSchema(buildCustomPropertiesSchema(defs)).parse(input)

  return await db.transaction(async (tx) => {
    const [contact] = await tx
      .insert(contacts)
      .values({ org_id: orgId, ...data })
      .returning()

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'contact.created',
      entity_type: 'contact',
      entity_id: contact!.id,
      summary: `Kontakt "${contact!.first_name} ${contact!.last_name}" wurde erstellt`,
      payload: { contact },
    })

    return contact!
  })
}

export async function updateContact(
  actorId: string,
  orgId: string,
  contactId: string,
  input: unknown,
  customFieldDefs?: CustomFieldDefinition[]
) {
  const defs = customFieldDefs ?? (await getCustomFieldDefs(orgId))
  const data = updateContactSchema(buildCustomPropertiesSchema(defs)).parse(input)

  return await db.transaction(async (tx) => {
    const [contact] = await tx
      .update(contacts)
      .set(data)
      .where(and(eq(contacts.id, contactId), eq(contacts.org_id, orgId), isNull(contacts.deleted_at)))
      .returning()

    if (!contact) throw new Error('Contact not found')

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'contact.updated',
      entity_type: 'contact',
      entity_id: contact.id,
      summary: `Kontakt "${contact.first_name} ${contact.last_name}" wurde aktualisiert`,
      payload: { contact },
    })

    return contact
  })
}

export async function deleteContact(actorId: string, orgId: string, contactId: string) {
  return await db.transaction(async (tx) => {
    const [contact] = await tx
      .update(contacts)
      .set({ deleted_at: new Date() })
      .where(and(eq(contacts.id, contactId), eq(contacts.org_id, orgId), isNull(contacts.deleted_at)))
      .returning()

    if (!contact) throw new Error('Contact not found')

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'contact.deleted',
      entity_type: 'contact',
      entity_id: contactId,
      summary: `Kontakt "${contact.first_name} ${contact.last_name}" wurde deaktiviert`,
      payload: { entity_id: contactId },
    })
  })
}
