/**
 * Channel-agnostic queue interface.
 *
 * Current implementation: Supabase table polling (ai.queue).
 * To swap for BullMQ: implement this interface, change one import in apps/agent.
 */
export interface QueueAdapter {
  /** Publish an event with an arbitrary payload. */
  publish(event: string, payload: unknown): Promise<void>

  /**
   * Register a handler for an event type.
   * The adapter is responsible for retries and marking jobs done/failed.
   * Call start() after registering all handlers.
   */
  subscribe(event: string, handler: (payload: unknown) => Promise<void>): void

  /** Begin polling / listening. */
  start(): Promise<void>

  /** Graceful shutdown. */
  stop(): Promise<void>
}

/** Events published by the Gateway Service. */
export type QueueEvent = 'message.incoming' | 'status.update'
