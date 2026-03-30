/**
 * Promptfoo custom provider.
 * Calls generateText directly (same as the agent) with a mocked fetch so tool
 * HTTP calls return fixture data instead of hitting a real API.
 */
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { buildTools, buildSystemPrompt } from '../packages/ai/src/index'
import { PROJECTS, REPORTS, CREATED_REPORT_STUB } from './fixtures'

// ---------------------------------------------------------------------------
// Mock fetch — intercepts all tool HTTP calls and returns fixture data
// ---------------------------------------------------------------------------
const MOCK_API_BASE = 'http://mock'
const realFetch = globalThis.fetch.bind(globalThis)

function mockFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const urlStr = url.toString()

  // Only intercept calls to our mock API base — let everything else (Google API etc.) through
  if (!urlStr.startsWith(MOCK_API_BASE)) {
    return realFetch(url as string, init)
  }

  const path = urlStr.replace(MOCK_API_BASE, '')
  const method = init?.method ?? 'GET'

  const json = (data: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }))

  // GET /api/v1/projects
  if (method === 'GET' && path.startsWith('/api/v1/projects') && !path.includes('/reports')) {
    const qs = new URL(url, 'http://x').searchParams
    const statusType = qs.get('status_type')
    const projects = statusType ? PROJECTS.filter(p => p.status.type === statusType) : PROJECTS
    const id = path.split('/')[4]
    if (id) return json(PROJECTS.find(p => p.id === id) ?? { error: 'Not found' }, id ? 200 : 404)
    return json(projects)
  }

  // GET /api/v1/projects/:id/reports
  if (method === 'GET' && path.match(/\/api\/v1\/projects\/.+\/reports$/)) {
    const projectId = path.split('/')[4]
    return json(REPORTS[projectId] ?? [])
  }

  // POST /api/v1/projects/:id/reports
  if (method === 'POST' && path.match(/\/api\/v1\/projects\/.+\/reports$/)) {
    const body = JSON.parse((init?.body as string) ?? '{}')
    return json({ ...CREATED_REPORT_STUB, ...body, project_id: path.split('/')[4] }, 201)
  }

  // PATCH /api/v1/reports/:id
  if (method === 'PATCH' && path.match(/\/api\/v1\/reports\/.+$/)) {
    const body = JSON.parse((init?.body as string) ?? '{}')
    return json({ id: path.split('/')[4], ...body })
  }

  // POST /api/v1/reports/:id/images
  if (method === 'POST' && path.match(/\/api\/v1\/reports\/.+\/images$/)) {
    return json({ id: 'img-mock' }, 201)
  }

  // GET /api/v1/companies
  if (method === 'GET' && path === '/api/v1/companies') {
    return json([{ id: 'dddd0001-0000-0000-0000-000000000001', name: 'Müller GmbH' }])
  }

  // GET /api/v1/contacts
  if (method === 'GET' && path === '/api/v1/contacts') return json([])

  // Catch-all: log and return empty ok
  console.warn(`[mock fetch] unhandled ${method} ${path}`)
  return json({ ok: true })
}

// ---------------------------------------------------------------------------
// Promptfoo provider — must be a class
// ---------------------------------------------------------------------------
export default class BaubarProvider {
  id() { return 'baubar-agent' }

  async callApi(prompt: string, context: { vars: Record<string, string> }) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY })
    const model  = google('gemini-2.5-flash')

    const ctx = {
      token:   'eval',
      apiBase: MOCK_API_BASE,
      orgId:   '00000000-0000-0000-0000-000000000001',
      userId:  'eval',
    }

    const toolCalls: string[] = []
    const toolArgs:  Record<string, unknown> = {}

    // Patch global fetch for this call only
    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch as typeof fetch

    let text = ''
    try {
      // Support multi-turn: vars.history is a JSON array of prior messages
      const history = context.vars.history
        ? JSON.parse(context.vars.history)
        : []

      const result = await generateText({
        model,
        system: buildSystemPrompt(),
        messages: [
          ...history,
          { role: 'user' as const, content: prompt },
        ],
        tools: buildTools(ctx),
        maxSteps: 5,
        onStepFinish: ({ toolCalls: calls }) => {
          for (const tc of calls ?? []) {
            toolCalls.push(tc.toolName)
            toolArgs[tc.toolName] = tc.args
          }
        },
      })
      text = result.text
    } finally {
      globalThis.fetch = originalFetch
    }

    // Embed toolCalls into the output JSON so all assertion types can access them.
    // javascript assertions: JSON.parse(output).toolsCalled
    // icontains assertions: searches the raw JSON string (text is embedded, so it works)
    return {
      output: JSON.stringify({ text, toolsCalled: toolCalls, toolArgs }),
    }
  }
}
