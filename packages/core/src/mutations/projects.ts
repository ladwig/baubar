import { eq, and, isNull } from 'drizzle-orm'
import { db, projects, customFieldDefinitions } from '@baubar/db'
import type { CustomFieldDefinition } from '@baubar/db'
import { emitEvent } from '../events'
import { buildCustomPropertiesSchema } from '../schemas/custom-fields'
import { createProjectSchema, updateProjectSchema } from '../schemas/project.schema'

async function getCustomFieldDefs(orgId: string, entityType: string) {
  return db
    .select()
    .from(customFieldDefinitions)
    .where(
      and(
        eq(customFieldDefinitions.org_id, orgId),
        eq(customFieldDefinitions.entity_type, entityType),
        isNull(customFieldDefinitions.deleted_at)
      )
    )
}

export async function createProject(
  actorId: string,
  orgId: string,
  input: unknown,
  customFieldDefs?: CustomFieldDefinition[]
) {
  const defs = customFieldDefs ?? (await getCustomFieldDefs(orgId, 'project'))
  const customSchema = buildCustomPropertiesSchema(defs)
  const data = createProjectSchema(customSchema).parse(input)

  return await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ org_id: orgId, ...data })
      .returning()

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'project.created',
      entity_type: 'project',
      entity_id: project!.id,
      summary: `Projekt "${project!.name}" wurde erstellt`,
      payload: { project },
    })

    return project!
  })
}

export async function updateProject(
  actorId: string,
  orgId: string,
  projectId: string,
  input: unknown,
  customFieldDefs?: CustomFieldDefinition[]
) {
  const defs = customFieldDefs ?? (await getCustomFieldDefs(orgId, 'project'))
  const customSchema = buildCustomPropertiesSchema(defs)
  const data = updateProjectSchema(customSchema).parse(input)

  return await db.transaction(async (tx) => {
    const [project] = await tx
      .update(projects)
      .set({ ...data, custom_properties: data.custom_properties ?? undefined })
      .where(and(eq(projects.id, projectId), eq(projects.org_id, orgId), isNull(projects.deleted_at)))
      .returning()

    if (!project) throw new Error('Project not found')

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'project.updated',
      entity_type: 'project',
      entity_id: project.id,
      summary: `Projekt "${project.name}" wurde aktualisiert`,
      payload: { project },
    })

    return project
  })
}

export async function deleteProject(actorId: string, orgId: string, projectId: string) {
  return await db.transaction(async (tx) => {
    const [project] = await tx
      .update(projects)
      .set({ deleted_at: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.org_id, orgId), isNull(projects.deleted_at)))
      .returning()

    if (!project) throw new Error('Project not found')

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'project.deleted',
      entity_type: 'project',
      entity_id: projectId,
      summary: `Projekt "${project.name}" wurde archiviert`,
      payload: { entity_id: projectId },
    })
  })
}
