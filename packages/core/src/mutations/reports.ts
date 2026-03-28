import { eq, and, isNull } from 'drizzle-orm'
import { db, projectReports, customFieldDefinitions } from '@baubar/db'
import type { CustomFieldDefinition } from '@baubar/db'
import { emitEvent } from '../events'
import { buildCustomPropertiesSchema } from '../schemas/custom-fields'
import { createReportSchema, updateReportSchema } from '../schemas/report.schema'

async function getCustomFieldDefs(orgId: string) {
  return db
    .select()
    .from(customFieldDefinitions)
    .where(
      and(
        eq(customFieldDefinitions.org_id, orgId),
        eq(customFieldDefinitions.entity_type, 'report'),
        isNull(customFieldDefinitions.deleted_at)
      )
    )
}

export async function createReport(
  actorId: string,
  orgId: string,
  projectId: string,
  input: unknown,
  customFieldDefs?: CustomFieldDefinition[]
) {
  const defs = customFieldDefs ?? (await getCustomFieldDefs(orgId))
  const data = createReportSchema(buildCustomPropertiesSchema(defs)).parse(input)

  return await db.transaction(async (tx) => {
    const [report] = await tx
      .insert(projectReports)
      .values({ org_id: orgId, project_id: projectId, author_id: actorId, ...data })
      .returning()

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'report.created',
      entity_type: 'project',
      entity_id: projectId,
      summary: `${report!.report_type} hinzugefügt`,
      payload: { report },
    })

    return report!
  })
}

export async function updateReport(
  actorId: string,
  orgId: string,
  reportId: string,
  input: unknown,
  customFieldDefs?: CustomFieldDefinition[]
) {
  const defs = customFieldDefs ?? (await getCustomFieldDefs(orgId))
  const data = updateReportSchema(buildCustomPropertiesSchema(defs)).parse(input)

  return await db.transaction(async (tx) => {
    const [report] = await tx
      .update(projectReports)
      .set(data)
      .where(
        and(
          eq(projectReports.id, reportId),
          eq(projectReports.org_id, orgId),
          isNull(projectReports.deleted_at)
        )
      )
      .returning()

    if (!report) throw new Error('Report not found')

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'report.updated',
      entity_type: 'report',
      entity_id: report.id,
      summary: `Bericht wurde aktualisiert`,
      payload: { report },
    })

    return report
  })
}

export async function deleteReport(actorId: string, orgId: string, reportId: string) {
  return await db.transaction(async (tx) => {
    const [report] = await tx
      .update(projectReports)
      .set({ deleted_at: new Date() })
      .where(
        and(
          eq(projectReports.id, reportId),
          eq(projectReports.org_id, orgId),
          isNull(projectReports.deleted_at)
        )
      )
      .returning()

    if (!report) throw new Error('Report not found')

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'report.deleted',
      entity_type: 'project',
      entity_id: report.project_id,
      summary: `${report.report_type} archiviert`,
      payload: { entity_id: reportId },
    })
  })
}
