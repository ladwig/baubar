import { eq, and, isNull } from 'drizzle-orm'
import { db, companies, customFieldDefinitions } from '@baubar/db'
import type { CustomFieldDefinition } from '@baubar/db'
import { emitEvent } from '../events'
import { buildCustomPropertiesSchema } from '../schemas/custom-fields'
import { createCompanySchema, updateCompanySchema } from '../schemas/company.schema'

async function getCustomFieldDefs(orgId: string) {
  return db
    .select()
    .from(customFieldDefinitions)
    .where(
      and(
        eq(customFieldDefinitions.org_id, orgId),
        eq(customFieldDefinitions.entity_type, 'company'),
        isNull(customFieldDefinitions.deleted_at)
      )
    )
}

export async function createCompany(
  actorId: string,
  orgId: string,
  input: unknown,
  customFieldDefs?: CustomFieldDefinition[]
) {
  const defs = customFieldDefs ?? (await getCustomFieldDefs(orgId))
  const data = createCompanySchema(buildCustomPropertiesSchema(defs)).parse(input)

  return await db.transaction(async (tx) => {
    const [company] = await tx
      .insert(companies)
      .values({ org_id: orgId, ...data })
      .returning()

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'company.created',
      entity_type: 'company',
      entity_id: company!.id,
      summary: `Unternehmen "${company!.name}" wurde erstellt`,
      payload: { company },
    })

    return company!
  })
}

export async function updateCompany(
  actorId: string,
  orgId: string,
  companyId: string,
  input: unknown,
  customFieldDefs?: CustomFieldDefinition[]
) {
  const defs = customFieldDefs ?? (await getCustomFieldDefs(orgId))
  const data = updateCompanySchema(buildCustomPropertiesSchema(defs)).parse(input)

  return await db.transaction(async (tx) => {
    const [company] = await tx
      .update(companies)
      .set(data)
      .where(and(eq(companies.id, companyId), eq(companies.org_id, orgId), isNull(companies.deleted_at)))
      .returning()

    if (!company) throw new Error('Company not found')

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'company.updated',
      entity_type: 'company',
      entity_id: company.id,
      summary: `Unternehmen "${company.name}" wurde aktualisiert`,
      payload: { company },
    })

    return company
  })
}

export async function deleteCompany(actorId: string, orgId: string, companyId: string) {
  return await db.transaction(async (tx) => {
    const [company] = await tx
      .update(companies)
      .set({ deleted_at: new Date() })
      .where(and(eq(companies.id, companyId), eq(companies.org_id, orgId), isNull(companies.deleted_at)))
      .returning()

    if (!company) throw new Error('Company not found')

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'company.deleted',
      entity_type: 'company',
      entity_id: companyId,
      summary: `Unternehmen "${company.name}" wurde deaktiviert`,
      payload: { entity_id: companyId },
    })
  })
}
