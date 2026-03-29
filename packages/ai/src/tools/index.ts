import { tool } from 'ai'
import { z } from 'zod'
import type { OrgContext } from '../types'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function headers(ctx: OrgContext) {
  return {
    Authorization: `Bearer ${ctx.token}`,
    'Content-Type': 'application/json',
    // Required for service-to-service calls (gateway → web) so the web app
    // knows which org to scope the request to without a Supabase JWT
    'X-Org-Id': ctx.orgId,
  }
}

async function apiFetch(ctx: OrgContext, path: string, init?: RequestInit) {
  const res = await fetch(`${ctx.apiBase}${path}`, {
    ...init,
    headers: { ...headers(ctx), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    // Return error as a value so the LLM can read it and self-correct (e.g. call list_reports)
    // rather than crashing the entire tool execution step.
    return { error: `${res.status}: ${body?.error ?? res.statusText}`, path }
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Tool definitions
// Each tool() call receives:
//   description  – shown to the LLM, be precise
//   parameters   – Zod schema; the LLM fills these in
//   execute      – called by the agentic loop when the LLM picks this tool
// ---------------------------------------------------------------------------

export type ToolsResult = {
  tools: ReturnType<typeof _buildTools>
  /** After generateText completes, read this to get any pending context the agent set. */
  getPendingContext: () => Record<string, unknown> | null
}

/**
 * Build tools + a reader for any pending context captured during the run.
 * Use this instead of buildTools() when you need to forward pending_context
 * back to the caller (e.g. gateway WhatsApp flow).
 */
export function buildToolsWithContext(ctx: OrgContext): ToolsResult {
  let captured: Record<string, unknown> | null = null
  const tools = _buildTools(ctx, (c) => { captured = c })
  return { tools, getPendingContext: () => captured }
}

/** Convenience wrapper — no pending context capture (web chat). */
export function buildTools(ctx: OrgContext) {
  return _buildTools(ctx)
}

function _buildTools(ctx: OrgContext, onPendingContext?: (c: Record<string, unknown>) => void) {
  return {
    // -- Projects ------------------------------------------------------------

    list_projects: tool({
      description:
        'List all active projects for the organisation. Optionally filter by status type. ' +
        'Returns id, name, address, status label and client name for each project.',
      parameters: z.preprocess((v) => v ?? {}, z.object({
        status_type: z
          .enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'DONE'])
          .optional()
          .describe('Filter by status type. Omit to return all active projects.'),
      })),
      execute: async ({ status_type }) => {
        const qs = status_type ? `?status_type=${status_type}` : ''
        return apiFetch(ctx, `/api/v1/projects${qs}`)
      },
    }),

    get_project: tool({
      description:
        'Fetch a single project by ID. Returns full details including status, ' +
        'address, planned hours, client, and any custom fields. ' +
        'IMPORTANT: project_id must be the UUID `id` field from list_projects results, NOT the project name.',
      parameters: z.object({
        project_id: z.string().uuid().describe('UUID `id` from list_projects — never a name or label'),
      }),
      execute: async ({ project_id }) => apiFetch(ctx, `/api/v1/projects/${project_id}`),
    }),

    // -- Reports -------------------------------------------------------------

    list_reports: tool({
      description:
        'List all reports for a specific project, newest first. ' +
        'Use this to answer any question about actual work progress, completion of phases, or what has happened on site — reports contain the real progress, not the project status field. ' +
        'IMPORTANT: project_id must be the UUID `id` field from list_projects, NOT the project name.',
      parameters: z.object({
        project_id: z.string().uuid().describe('UUID `id` from list_projects — never a name or label'),
      }),
      execute: async ({ project_id }) =>
        apiFetch(ctx, `/api/v1/projects/${project_id}/reports`),
    }),

    create_report: tool({
      description:
        'Create a report on a project. ' +
        'If the user gave a project name instead of a UUID, call list_projects first to resolve it. ' +
        'If report_type was not specified by the user, ask them to choose. ' +
        'If the report text was not provided by the user, ask what to write. ' +
        'Never invent or assume report_type or text_content — both must come explicitly from the user.',
      parameters: z.object({
        project_id: z.string().uuid().describe('UUID from list_projects'),
        report_type: z
          .enum(['Tagesbericht', 'Mängelprotokoll', 'Abnahme', 'Begehung', 'Sonstiges'])
          .describe('Chosen by the user'),
        text_content: z.string().describe('Written by the user'),
      }),
      execute: async ({ project_id, report_type, text_content }) =>
        apiFetch(ctx, `/api/v1/projects/${project_id}/reports`, {
          method: 'POST',
          body: JSON.stringify({ report_type, text_content }),
        }),
    }),

    // -- Companies -----------------------------------------------------------

    list_companies: tool({
      description:
        'List all active companies (clients / subcontractors) in the organisation. ' +
        'Always call this first before get_company — you need the UUID `id` from these results.',
      // Groq can send null for empty-parameter tools — preprocess to {} to avoid validation errors
      parameters: z.preprocess((v) => v ?? {}, z.object({})),
      execute: async () => apiFetch(ctx, '/api/v1/companies'),
    }),

    get_company: tool({
      description:
        'Fetch a single company by ID including contacts and linked projects. ' +
        'IMPORTANT: company_id must be the UUID `id` field from list_companies results, NOT the company name.',
      parameters: z.object({
        company_id: z.string().uuid().describe('UUID `id` from list_companies — never a name or label'),
      }),
      execute: async ({ company_id }) => apiFetch(ctx, `/api/v1/companies/${company_id}`),
    }),

    // -- Contacts ------------------------------------------------------------

    // -- Reports (edit) ------------------------------------------------------

    update_report: tool({
      description:
        'Update the text content of an existing report. ' +
        'Use when the user wants to add to or change what a report says. ' +
        'IMPORTANT: report_id is the `id` field from the create_report or list_reports response — NOT the project_id. ' +
        'Merge the existing text with the new information — never drop existing content. ' +
        'Act immediately without asking for confirmation.',
      parameters: z.object({
        report_id:    z.string().describe('The `id` UUID from a create_report or list_reports tool result in this conversation — NEVER invent this value'),
        text_content: z.string().describe('Merged full text — existing content + new information, nothing omitted'),
      }),
      execute: async ({ report_id, text_content }) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(report_id)
        if (!isUuid) {
          return { error: `"${report_id}" is not a valid report ID. Call list_reports first to get the correct UUID, then retry update_report.` }
        }
        return apiFetch(ctx, `/api/v1/reports/${report_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ text_content }),
        })
      },
    }),

    add_images_to_report: tool({
      description:
        'Attach one or more already-uploaded images to a report. ' +
        'temp_paths are the storage paths from the [Bild(er) hochgeladen] message. ' +
        'If [Pending context from previous turn] is present, use report_id from there directly.',
      parameters: z.object({
        report_id:  z.string().describe('UUID of the report — from a create_report or list_reports tool result, or from pending context. NEVER invent this.'),
        temp_paths: z.array(z.string()).min(1).describe('Storage temp paths from the uploaded images'),
      }),
      execute: async ({ report_id, temp_paths }) => {
        const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
        if (!isUuid(report_id)) {
          return { error: `"${report_id}" is not a valid report ID. Call list_reports first to get the correct UUID.` }
        }
        const results = await Promise.all(
          temp_paths.map((temp_path) =>
            apiFetch(ctx, `/api/v1/reports/${report_id}/images`, {
              method: 'POST',
              body: JSON.stringify({ temp_path }),
            })
          )
        )
        return results
      },
    }),

    // -- Contacts ------------------------------------------------------------

    // -- Pending context (WhatsApp multi-webhook flows) -----------------------

    set_pending_context: tool({
      description:
        'Remember context for the NEXT inbound WhatsApp message from this conversation. ' +
        'Use when the user says something like "schick die nächsten Bilder zu diesem Bericht" — ' +
        'store the report_id (and project_id) so that when the image webhooks arrive you can ' +
        'attach them to the right report without asking again. ' +
        'The context is one-shot: it is cleared automatically after being read once. ' +
        'Only call this on WhatsApp. Do NOT call on web chat.',
      parameters: z.object({
        context: z.record(z.unknown()).describe('Small key/value payload, e.g. { report_id } — IDs must come from tool results, never invented'),
      }),
      execute: async ({ context }) => {
        if (onPendingContext) onPendingContext(context)
        return { ok: true }
      },
    }),

    list_contacts: tool({
      description: 'List all contacts, optionally filtered by company.',
      parameters: z.preprocess((v) => v ?? {}, z.object({
        company_id: z
          .string()
          .uuid()
          .optional()
          .describe('UUID `id` from list_companies to filter contacts by company — never a name'),
      })),
      execute: async ({ company_id }) => {
        const qs = company_id ? `?company_id=${company_id}` : ''
        return apiFetch(ctx, `/api/v1/contacts${qs}`)
      },
    }),
  }
}

export type BaubarTools = ReturnType<typeof buildTools>
