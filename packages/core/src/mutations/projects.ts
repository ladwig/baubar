import { eq, and, isNull } from 'drizzle-orm'
import { db, projects, projectStatuses, customFieldDefinitions, projectMembers } from '@baubar/db'
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
  actorId: string | null,
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
  actorId: string | null,
  orgId: string,
  projectId: string,
  input: unknown,
  customFieldDefs?: CustomFieldDefinition[]
) {
  const defs = customFieldDefs ?? (await getCustomFieldDefs(orgId, 'project'))
  const customSchema = buildCustomPropertiesSchema(defs)
  const data = updateProjectSchema(customSchema).parse(input)

  return await db.transaction(async (tx) => {
    // Fetch old state for change tracking
    const [old] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.org_id, orgId), isNull(projects.deleted_at)))

    if (!old) throw new Error('Project not found')

    const [project] = await tx
      .update(projects)
      .set({ ...data, custom_properties: data.custom_properties ?? undefined })
      .where(and(eq(projects.id, projectId), eq(projects.org_id, orgId), isNull(projects.deleted_at)))
      .returning()

    if (!project) throw new Error('Project not found')

    // Compute diff for human-readable change log
    const changes: Record<string, { old: unknown; new: unknown }> = {}

    for (const f of ['name', 'address', 'planned_hours'] as const) {
      if (String(old[f] ?? '') !== String(project[f] ?? '')) {
        changes[f] = { old: old[f], new: project[f] }
      }
    }

    if (old.status_id !== project.status_id) {
      const resolveLabel = async (id: string | null) => {
        if (!id) return null
        const [s] = await tx.select({ label: projectStatuses.label }).from(projectStatuses).where(eq(projectStatuses.id, id))
        return s?.label ?? id
      }
      changes.status = {
        old: await resolveLabel(old.status_id),
        new: await resolveLabel(project.status_id),
      }
    }

    // Diff custom_properties
    const oldProps = (old.custom_properties ?? {}) as Record<string, unknown>
    const newProps = (project.custom_properties ?? {}) as Record<string, unknown>
    for (const key of new Set([...Object.keys(oldProps), ...Object.keys(newProps)])) {
      if (String(oldProps[key] ?? '') !== String(newProps[key] ?? '')) {
        changes[key] = { old: oldProps[key] ?? null, new: newProps[key] ?? null }
      }
    }

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'project.updated',
      entity_type: 'project',
      entity_id: project.id,
      summary: `Projekt "${project.name}" wurde aktualisiert`,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
      payload: { project },
    })

    return project
  })
}

export async function addProjectMember(actorId: string | null, orgId: string, projectId: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [member] = await tx
      .insert(projectMembers)
      .values({ project_id: projectId, user_id: userId })
      .onConflictDoUpdate({ target: [projectMembers.project_id, projectMembers.user_id], set: { deleted_at: null } })
      .returning()

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'project.member_added',
      entity_type: 'project',
      entity_id: projectId,
      summary: `Mitglied hinzugefügt`,
      payload: { project_id: projectId, user_id: userId },
    })

    return member
  })
}

export async function removeProjectMember(actorId: string | null, orgId: string, projectId: string, userId: string) {
  return await db.transaction(async (tx) => {
    await tx
      .update(projectMembers)
      .set({ deleted_at: new Date() })
      .where(and(eq(projectMembers.project_id, projectId), eq(projectMembers.user_id, userId)))

    await emitEvent(tx as any, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'project.member_removed',
      entity_type: 'project',
      entity_id: projectId,
      summary: `Mitglied entfernt`,
      payload: { project_id: projectId, user_id: userId },
    })
  })
}

export async function deleteProject(actorId: string | null, orgId: string, projectId: string) {
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
