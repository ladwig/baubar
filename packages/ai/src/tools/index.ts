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
  }
}

async function apiFetch(ctx: OrgContext, path: string, init?: RequestInit) {
  const res = await fetch(`${ctx.apiBase}${path}`, {
    ...init,
    headers: { ...headers(ctx), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${init?.method ?? 'GET'} ${path} failed (${res.status}): ${text}`)
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

export function buildTools(ctx: OrgContext) {
  return {
    // -- Projects ------------------------------------------------------------

    list_projects: tool({
      description:
        'List all active projects for the organisation. Optionally filter by status type. ' +
        'Returns id, name, address, status label and client name for each project.',
      parameters: z.object({
        status_type: z
          .enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'DONE'])
          .optional()
          .describe('Filter by status type. Omit to return all active projects.'),
      }),
      execute: async ({ status_type }) => {
        const qs = status_type ? `?status_type=${status_type}` : ''
        return apiFetch(ctx, `/api/v1/projects${qs}`)
      },
    }),

    get_project: tool({
      description:
        'Fetch a single project by ID. Returns full details including status, ' +
        'address, planned hours, client, and any custom fields.',
      parameters: z.object({
        project_id: z.string().uuid().describe('UUID of the project'),
      }),
      execute: async ({ project_id }) => apiFetch(ctx, `/api/v1/projects/${project_id}`),
    }),

    // -- Reports -------------------------------------------------------------

    list_reports: tool({
      description: 'List all reports for a specific project, newest first.',
      parameters: z.object({
        project_id: z.string().uuid(),
      }),
      execute: async ({ project_id }) =>
        apiFetch(ctx, `/api/v1/projects/${project_id}/reports`),
    }),

    create_report: tool({
      description:
        'Create a new report on a project. Use this when the user wants to log ' +
        'a daily report, incident, inspection, or similar field note.',
      parameters: z.object({
        project_id: z.string().uuid(),
        report_type: z
          .enum(['Tagesbericht', 'Mängelprotokoll', 'Abnahme', 'Begehung', 'Sonstiges'])
          .describe('Type of report'),
        text_content: z.string().describe('Body text of the report'),
      }),
      execute: async ({ project_id, report_type, text_content }) =>
        apiFetch(ctx, `/api/v1/projects/${project_id}/reports`, {
          method: 'POST',
          body: JSON.stringify({ report_type, text_content }),
        }),
    }),

    // -- Companies -----------------------------------------------------------

    list_companies: tool({
      description: 'List all active companies (clients / subcontractors) in the organisation.',
      parameters: z.object({}),
      execute: async () => apiFetch(ctx, '/api/v1/companies'),
    }),

    get_company: tool({
      description: 'Fetch a single company by ID including contacts and linked projects.',
      parameters: z.object({
        company_id: z.string().uuid(),
      }),
      execute: async ({ company_id }) => apiFetch(ctx, `/api/v1/companies/${company_id}`),
    }),

    // -- Contacts ------------------------------------------------------------

    list_contacts: tool({
      description: 'List all contacts, optionally filtered by company.',
      parameters: z.object({
        company_id: z
          .string()
          .uuid()
          .optional()
          .describe('Filter contacts belonging to a specific company'),
      }),
      execute: async ({ company_id }) => {
        const qs = company_id ? `?company_id=${company_id}` : ''
        return apiFetch(ctx, `/api/v1/contacts${qs}`)
      },
    }),
  }
}

export type BaubarTools = ReturnType<typeof buildTools>
