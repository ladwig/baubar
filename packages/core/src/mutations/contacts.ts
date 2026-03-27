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
    const [old] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.org_id, orgId), isNull(contacts.deleted_at)))

    if (!old) throw new Error('Contact not found')

    const [contact] = await tx
      .update(contacts)
      .set(data)
      .where(and(eq(contacts.id, contactId), eq(contacts.org_id, orgId), isNull(contacts.deleted_at)))
      .returning()

    if (!contact) throw new Error('Contact not found')

    const changes: Record<string, { old: unknown; new: unknown }> = {}
    for (const f of ['first_name', 'last_name', 'email', 'phone', 'contact_type'] as const) {
      if ((old[f] ?? '') !== (contact[f] ?? '')) {
        changes[f] = { old: old[f], new: contact[f] }
      }
    }

    const oldProps = (old.custom_properties ?? {}) as Record<string, unknown>
    const newProps = (contact.custom_properties ?? {}) as Record<string, unknown>
    for (const key of new Set([...Object.keys(oldProps), ...Object.keys(newProps)])) {
      if (String(oldProps[key] ?? '') !== String(newProps[key] ?? '')) {
        changes[key] = { old: oldProps[key] ?? null, new: newProps[key] ?? null }
      }
    }

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'contact.updated',
      entity_type: 'contact',
      entity_id: contact.id,
      summary: `Kontakt "${contact.first_name} ${contact.last_name}" wurde aktualisiert`,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
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
