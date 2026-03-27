import type { QueueAdapter } from './types'

const POLL_INTERVAL_MS = 2000
const MAX_ATTEMPTS = 3

/**
 * Supabase table-based queue implementation.
 *
 * Publishes jobs by inserting into ai.queue.
 * Consumes by polling for pending rows, claiming them via a status update,
 * running the handler, then marking done or failed.
 *
 * Swap this out for BullMQ by implementing QueueAdapter with a Bull queue —
 * no other files need to change.
 */
export class SupabaseQueueAdapter implements QueueAdapter {
  private handlers = new Map<string, (payload: unknown) => Promise<void>>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly databaseUrl: string) {}

  async publish(event: string, payload: unknown): Promise<void> {
    // Direct SQL insert — no Drizzle dependency here so gateway can use this
    // package without pulling in the full db schema.
    const res = await fetch(`${this.databaseUrl}/rest/v1/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Caller must set apiKey header externally via a wrapper or pass headers in constructor.
        // See SupabaseQueueAdapter.withHeaders() below.
        ...this.extraHeaders,
      },
      body: JSON.stringify({ event, payload }),
    })
    if (!res.ok) throw new Error(`Queue publish failed: ${res.status} ${await res.text()}`)
  }

  subscribe(event: string, handler: (payload: unknown) => Promise<void>): void {
    this.handlers.set(event, handler)
  }

  async start(): Promise<void> {
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS)
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private extraHeaders: Record<string, string> = {}

  /** Set Supabase API key and schema headers required for REST calls. */
  withHeaders(headers: Record<string, string>): this {
    this.extraHeaders = headers
    return this
  }

  private async poll(): Promise<void> {
    // Claim one pending job atomically via UPDATE ... RETURNING
    // so multiple agent instances don't double-process.
    const res = await fetch(
      `${this.databaseUrl}/rest/v1/rpc/claim_queue_job`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.extraHeaders },
        body: JSON.stringify({}),
      },
    )

    if (!res.ok) return
    const job = await res.json() as { id: string; event: string; payload: unknown } | null
    if (!job) return

    const handler = this.handlers.get(job.event)
    if (!handler) {
      await this.markDone(job.id, 'done') // no handler registered — discard
      return
    }

    try {
      await handler(job.payload)
      await this.markDone(job.id, 'done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.markFailed(job.id, msg)
    }
  }

  private async markDone(id: string, status: 'done'): Promise<void> {
    await fetch(`${this.databaseUrl}/rest/v1/queue?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.extraHeaders },
      body: JSON.stringify({ status, processed_at: new Date().toISOString() }),
    })
  }

  private async markFailed(id: string, error: string): Promise<void> {
    // Increment attempts; only set status=failed when MAX_ATTEMPTS reached.
    await fetch(`${this.databaseUrl}/rest/v1/rpc/fail_queue_job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.extraHeaders },
      body: JSON.stringify({ job_id: id, error_msg: error, max_attempts: MAX_ATTEMPTS }),
    })
  }
}
