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
