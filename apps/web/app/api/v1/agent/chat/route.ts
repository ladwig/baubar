import { NextRequest } from 'next/server'
import { requireOrgContext } from '@/lib/api'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function agentUrl(path: string) {
  return `${process.env.AGENT_SERVICE_URL ?? 'http://localhost:3001'}${path}`
}

async function getToken() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

/** GET /api/v1/agent/chat?threadId=... — load thread history */
export async function GET(req: NextRequest) {
  const { error } = await requireOrgContext()
  if (error) return error

  const token = await getToken()
  const threadId = req.nextUrl.searchParams.get('threadId')
  const qs = threadId ? `?threadId=${threadId}` : ''

  const upstream = await fetch(agentUrl(`/chat${qs}`), {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await upstream.json()
  return Response.json(data, { status: upstream.status })
}

/** POST /api/v1/agent/chat — stream a chat turn */
export async function POST(req: NextRequest) {
  const { error } = await requireOrgContext()
  if (error) return error

  const token = await getToken()

  const upstream = await fetch(agentUrl('/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: req.body,
    // @ts-expect-error — Node 18+ fetch supports duplex streaming
    duplex: 'half',
  })

  const headers = new Headers()
  upstream.headers.forEach((value, key) => headers.set(key, value))
  headers.set('Cache-Control', 'no-cache')

  return new Response(upstream.body, { status: upstream.status, headers })
}
