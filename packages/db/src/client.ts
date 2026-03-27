import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Singleton pattern: reuse the connection pool across hot-reloads in dev
// and across imports in tests. Without this, each module evaluation opens
// a new pool and Supabase quickly hits its connection limit.
const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql }

const client =
  globalForDb._pgClient ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false, // required for Supabase transaction pooler
    max: 5,         // keep pool small; Supabase free tier allows ~15 total
    idle_timeout: 20,
    connect_timeout: 10,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb._pgClient = client
}

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development',
})

export type DB = typeof db
