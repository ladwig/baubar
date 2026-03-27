import { requireOrgContext } from '@/lib/api'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/** POST /api/v1/agent/thread — create a new conversation thread */
export async function POST() {
  const { error } = await requireOrgContext()
  if (error) return error

  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''

  const upstream = await fetch(
    `${process.env.AGENT_SERVICE_URL ?? 'http://localhost:3001'}/thread`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
  )
  const data = await upstream.json()
  return Response.json(data, { status: upstream.status })
}
