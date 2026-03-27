# baubar – Construction OS · Implementation Blueprint

> This file is the single source of truth for Claude Code.
> Read it fully before writing any code. Follow the phases in order.
> Never skip a phase. Never hard-delete data. Always emit an event inside the same transaction as a mutation.

---

## 1. Project Overview

**baubar** is a multi-tenant B2B SaaS project management tool for construction companies.

- **Stack:** Next.js 14 (App Router), Supabase (PostgreSQL + Auth + Storage), Turborepo Monorepo
- **UI:** shadcn/ui + TanStack Table – simple, data-dense, no unnecessary animations
- **DB Schema:** Everything lives in the `project_management` Postgres schema on Supabase
- **Auth:** Supabase Auth (email + password). Users are created manually in Supabase Dashboard for Alpha.
- **API:** REST via Next.js Route Handlers (`/api/v1/...`). API-first – no business logic in UI components.
- **Out of scope for now:** AI service, WhatsApp gateway, offline support, time tracking, tasks

---

## 2. Monorepo Structure

```
baubar-os/
├── apps/
│   └── web/                          # Next.js 14 App Router
│       ├── app/
│       │   ├── (auth)/
│       │   │   └── login/page.tsx
│       │   ├── (app)/
│       │   │   ├── layout.tsx         # Sidebar + OrgContext
│       │   │   ├── projects/
│       │   │   │   ├── page.tsx       # List
│       │   │   │   ├── new/page.tsx
│       │   │   │   └── [id]/
│       │   │   │       ├── page.tsx   # Detail: tabs (Overview / Reports / Activity)
│       │   │   │       └── reports/new/page.tsx
│       │   │   ├── companies/
│       │   │   │   ├── page.tsx
│       │   │   │   ├── new/page.tsx
│       │   │   │   └── [id]/page.tsx
│       │   │   ├── contacts/
│       │   │   │   ├── page.tsx
│       │   │   │   ├── new/page.tsx
│       │   │   │   └── [id]/page.tsx
│       │   │   └── settings/
│       │   │       ├── custom-fields/page.tsx
│       │   │       └── statuses/page.tsx
│       │   └── api/v1/
│       │       ├── projects/
│       │       │   ├── route.ts        # GET list, POST create
│       │       │   └── [id]/
│       │       │       ├── route.ts    # GET, PATCH, DELETE (soft)
│       │       │       └── reports/route.ts
│       │       ├── companies/
│       │       │   ├── route.ts
│       │       │   └── [id]/route.ts
│       │       ├── contacts/
│       │       │   ├── route.ts
│       │       │   └── [id]/route.ts
│       │       ├── events/route.ts     # GET only – activity feed
│       │       └── admin/
│       │           ├── custom-fields/route.ts
│       │           └── statuses/route.ts
│       └── middleware.ts
├── packages/
│   ├── config/                        # tsconfig, eslint, prettier – built first
│   ├── db/                            # Drizzle ORM schema + Supabase client
│   ├── core/                          # Zod schemas + mutation functions + emitEvent
│   └── ui/                            # Shared shadcn/ui components
├── turbo.json
└── package.json
```

**Build order:** `config` → `db` → `core` → `ui` → `web`

---

## 3. Database – Full Migration SQL

Run migrations in this exact order inside the `project_management` schema.

```sql
-- ============================================================
-- SETUP: Create schema and grant permissions
-- ============================================================
CREATE SCHEMA IF NOT EXISTS project_management;
GRANT USAGE ON SCHEMA project_management TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA project_management TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA project_management
  GRANT ALL ON TABLES TO authenticated;


-- ============================================================
-- MIGRATION 001: Enums
-- ============================================================
CREATE TYPE project_management.status_type AS ENUM (
  'OPEN', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'DONE'
);


-- ============================================================
-- MIGRATION 002: Organizations
-- ============================================================
CREATE TABLE project_management.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);


-- ============================================================
-- MIGRATION 003: Users (mirrors auth.users 1:1)
-- ============================================================
CREATE TABLE project_management.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create user row on Supabase Auth signup
CREATE OR REPLACE FUNCTION project_management.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_management.users (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION project_management.handle_new_user();


-- ============================================================
-- MIGRATION 004: Org Members (user ↔ org + role)
-- ============================================================
CREATE TABLE project_management.org_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES project_management.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'worker',
  -- Alpha roles: 'admin', 'worker'. Add more later, it's just TEXT.
  deleted_at  TIMESTAMPTZ,
  UNIQUE(org_id, user_id)
);


-- ============================================================
-- MIGRATION 005: Project Statuses (org-defined, system-typed)
-- ============================================================
CREATE TABLE project_management.project_statuses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  status_type  project_management.status_type NOT NULL,
  color        TEXT DEFAULT '#6B7280',
  sort_order   INT DEFAULT 0,
  is_default   BOOLEAN DEFAULT FALSE,
  deleted_at   TIMESTAMPTZ,
  UNIQUE(org_id, label)
);

-- Seed default statuses when a new org is created
CREATE OR REPLACE FUNCTION project_management.seed_default_statuses()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_management.project_statuses
    (org_id, label, status_type, color, sort_order, is_default)
  VALUES
    (NEW.id, 'Offen',         'OPEN',        '#6B7280', 0, TRUE),
    (NEW.id, 'In Arbeit',     'IN_PROGRESS',  '#3B82F6', 1, FALSE),
    (NEW.id, 'Wartend',       'WAITING',      '#F59E0B', 2, FALSE),
    (NEW.id, 'Blockiert',     'BLOCKED',      '#EF4444', 3, FALSE),
    (NEW.id, 'Abgeschlossen', 'DONE',         '#10B981', 4, FALSE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_org_created
  AFTER INSERT ON project_management.organizations
  FOR EACH ROW EXECUTE FUNCTION project_management.seed_default_statuses();


-- ============================================================
-- MIGRATION 006: Custom Field Definitions
-- ============================================================
CREATE TABLE project_management.custom_field_definitions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('project', 'company', 'contact', 'report')),
  name         TEXT NOT NULL,   -- internal key e.g. 'price'
  label        TEXT NOT NULL,   -- UI label e.g. 'Gesamtpreis (€)'
  field_type   TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'select')),
  options      JSONB,           -- for 'select' type: ["Option A", "Option B"]
  sort_order   INT DEFAULT 0,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, entity_type, name)
);


-- ============================================================
-- MIGRATION 007: Companies (external clients / subcontractors)
-- ============================================================
CREATE TABLE project_management.companies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  address             TEXT,
  industry            TEXT,
  custom_properties   JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_companies_custom ON project_management.companies USING GIN (custom_properties);


-- ============================================================
-- MIGRATION 008: Contacts (external individuals)
-- ============================================================
CREATE TABLE project_management.contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES project_management.companies(id) ON DELETE SET NULL,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT,
  phone               TEXT CHECK (phone ~ '^\+[1-9]\d{6,14}$' OR phone IS NULL), -- E.164 format
  contact_type        TEXT,  -- e.g. 'architect', 'owner', 'private'
  custom_properties   JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_contacts_custom ON project_management.contacts USING GIN (custom_properties);


-- ============================================================
-- MIGRATION 009: Projects
-- ============================================================
CREATE TABLE project_management.projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  company_id          UUID REFERENCES project_management.companies(id) ON DELETE SET NULL,
  contact_id          UUID REFERENCES project_management.contacts(id) ON DELETE SET NULL,
  status_id           UUID REFERENCES project_management.project_statuses(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  address             TEXT,
  planned_hours       DECIMAL DEFAULT 0.0,
  custom_properties   JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT project_must_have_client CHECK (
    company_id IS NOT NULL OR contact_id IS NOT NULL
  )
);

CREATE INDEX idx_projects_custom ON project_management.projects USING GIN (custom_properties);
CREATE INDEX idx_projects_org_status ON project_management.projects(org_id, status_id);


-- ============================================================
-- MIGRATION 010: Project Members (internal employees on a project)
-- ============================================================
CREATE TABLE project_management.project_members (
  project_id  UUID NOT NULL REFERENCES project_management.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES project_management.users(id) ON DELETE CASCADE,
  role        TEXT DEFAULT 'worker',
  deleted_at  TIMESTAMPTZ,
  PRIMARY KEY (project_id, user_id)
);


-- ============================================================
-- MIGRATION 011: Project Reports
-- ============================================================
CREATE TABLE project_management.project_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES project_management.projects(id) ON DELETE CASCADE,
  author_id           UUID REFERENCES project_management.users(id),
  report_type         TEXT NOT NULL,  -- e.g. 'daily', 'incident', 'inspection'
  text_content        TEXT,
  custom_properties   JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);


-- ============================================================
-- MIGRATION 012: Report Images
-- ============================================================
CREATE TABLE project_management.report_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL REFERENCES project_management.project_reports(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,   -- Supabase Storage path
  uploaded_by   UUID REFERENCES project_management.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- MIGRATION 013: Report Comments
-- ============================================================
CREATE TABLE project_management.report_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES project_management.project_reports(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES project_management.users(id),
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);


-- ============================================================
-- MIGRATION 014: Events (unified audit log + event bus)
-- ============================================================
-- This table serves TWO purposes:
-- 1. UI Activity Feed → reads `summary` + `changes`
-- 2. Future: Notifications, AI context → reads `payload`, checks `processed_at`
CREATE TABLE project_management.events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES project_management.organizations(id),
  actor_id      UUID REFERENCES project_management.users(id),
  event_type    TEXT NOT NULL,
  -- naming convention: 'entity.action' e.g. 'project.created', 'project.status_changed'
  entity_type   TEXT NOT NULL,   -- 'project', 'company', 'contact', 'report'
  entity_id     UUID NOT NULL,   -- no FK intentionally – entity may be soft-deleted
  summary       TEXT,            -- human-readable: "Max changed status from 'Open' to 'Active'"
  changes       JSONB,           -- diff: {"status": {"old": "...", "new": "..."}}
  payload       JSONB NOT NULL,  -- full snapshot for machine consumers
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at  TIMESTAMPTZ      -- NULL = pending for async consumers
);

CREATE INDEX idx_events_entity ON project_management.events(entity_type, entity_id);
CREATE INDEX idx_events_org_time ON project_management.events(org_id, created_at DESC);


-- ============================================================
-- MIGRATION 015: Row Level Security (RLS)
-- ============================================================
-- Pattern: users can only access rows where org_id matches their org membership.
-- Apply to every table in project_management schema.

ALTER TABLE project_management.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.project_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.project_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.report_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_management.events ENABLE ROW LEVEL SECURITY;

-- Reusable helper: check if current user belongs to an org
CREATE OR REPLACE FUNCTION project_management.current_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM project_management.org_members
  WHERE user_id = auth.uid() AND deleted_at IS NULL
$$ LANGUAGE sql SECURITY DEFINER;

-- Template policy (repeat for each table that has org_id):
CREATE POLICY "org_isolation" ON project_management.projects
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.companies
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.contacts
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.project_reports
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.events
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.project_statuses
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.custom_field_definitions
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

-- Users can read their own profile + profiles of org members
CREATE POLICY "users_in_same_org" ON project_management.users
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM project_management.org_members
      WHERE org_id IN (SELECT project_management.current_user_org_ids())
    )
  );
```

---

## 4. `packages/db` – Drizzle ORM Setup

```typescript
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false  // required for Supabase transaction pooler
})

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development'
})

export type DB = typeof db
```

```typescript
// packages/db/src/schema/index.ts
// Re-export all Drizzle table definitions here.
// Table definitions mirror the SQL migrations above exactly.
// Use pgSchema('project_management') for all tables.
import { pgSchema } from 'drizzle-orm/pg-core'
export const pm = pgSchema('project_management')
// Define each table using pm.table('name', { ... })
```

---

## 5. `packages/core` – Business Logic

### 5.1 Event Emitter (CRITICAL – never mutate without emitting)

```typescript
// packages/core/src/events.ts
import type { DB } from '@baubar/db'

export type DomainEventInput = {
  org_id: string
  actor_id: string
  event_type: string        // 'project.created' | 'project.status_changed' | etc.
  entity_type: string
  entity_id: string
  summary: string           // human-readable sentence
  changes?: Record<string, { old: unknown; new: unknown }>
  payload: Record<string, unknown>  // full snapshot
}

export async function emitEvent(tx: DB, event: DomainEventInput) {
  await tx.insert(eventsTable).values(event)
  // Always called inside the same DB transaction as the mutation.
  // This guarantees: no mutation without a log, no orphaned events.
}
```

### 5.2 Custom Field Schema Builder

```typescript
// packages/core/src/schemas/custom-fields.ts
import { z } from 'zod'
import type { CustomFieldDefinition } from '@baubar/db'

export function buildCustomPropertiesSchema(definitions: CustomFieldDefinition[]) {
  const shape = Object.fromEntries(
    definitions.map(def => {
      const baseSchema =
        def.field_type === 'number'  ? z.number() :
        def.field_type === 'boolean' ? z.boolean() :
        def.field_type === 'date'    ? z.string().date() :
        def.field_type === 'select'  ? z.enum(def.options as [string, ...string[]]) :
        z.string()
      return [def.name, baseSchema.optional()]
    })
  )
  return z.object(shape).default({})
}
// New fields are always .optional() so old records without the key are valid.
// When saving: use JSONB merge (|| operator) to add keys without overwriting others.
```

### 5.3 Mutation Pattern (example: projects)

```typescript
// packages/core/src/mutations/projects.ts
import { db } from '@baubar/db'
import { emitEvent } from '../events'
import { createProjectSchema } from '../schemas/project.schema'

export async function createProject(
  actorId: string,
  orgId: string,
  input: unknown,
  customFieldDefs: CustomFieldDefinition[]
) {
  const customSchema = buildCustomPropertiesSchema(customFieldDefs)
  const schema = createProjectSchema(customSchema)
  const data = schema.parse(input)  // throws ZodError if invalid

  return await db.transaction(async (tx) => {
    const [project] = await tx.insert(projectsTable).values({
      org_id: orgId,
      ...data
    }).returning()

    await emitEvent(tx, {
      org_id: orgId,
      actor_id: actorId,
      event_type: 'project.created',
      entity_type: 'project',
      entity_id: project.id,
      summary: `Project "${project.name}" was created`,
      payload: { project }
    })

    return project
  })
}

export async function softDelete(
  table: any,
  actorId: string,
  orgId: string,
  entityId: string,
  entityType: string,
  entityName: string
) {
  return await db.transaction(async (tx) => {
    await tx.update(table)
      .set({ deleted_at: new Date() })
      .where(eq(table.id, entityId))

    await emitEvent(tx, {
      org_id: orgId, actor_id: actorId,
      event_type: `${entityType}.deleted`,
      entity_type: entityType,
      entity_id: entityId,
      summary: `"${entityName}" was deactivated`,
      payload: { entity_id: entityId }
    })
  })
}
// NEVER use DELETE. Always use softDelete().
```

---

## 6. API Route Pattern

Every route follows this exact structure. No exceptions.

```typescript
// apps/web/app/api/v1/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createProject } from '@baubar/core/mutations/projects'
import { getOrgContext } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // 1. Auth check
  const { user, orgId, role } = await getOrgContext(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Parse body (raw – Zod validation happens inside core mutation)
  const body = await req.json()

  // 3. Fetch custom field definitions for this org + entity type
  const customFieldDefs = await getCustomFieldDefs(orgId, 'project')

  // 4. Call core mutation (handles validation + DB write + event emit)
  try {
    const project = await createProject(user.id, orgId, body, customFieldDefs)
    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 422 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { orgId } = await getOrgContext(req)
  // Query active (non-deleted) projects for this org
  // JOIN with project_statuses for status label + color
  // JOIN with companies/contacts for client name
  // Support ?status_type=OPEN&search=... query params
}
```

---

## 7. Auth & Org Context

```typescript
// apps/web/lib/auth.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getOrgContext(req?: Request) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookies().get(name)?.value } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, orgId: null, role: null }

  // Resolve org membership (Alpha: one org per user)
  const { data: membership } = await supabase
    .schema('project_management')
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  return {
    user,
    orgId: membership?.org_id ?? null,
    role: membership?.role ?? null
  }
}
```

```typescript
// apps/web/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const isAuthPage = req.nextUrl.pathname.startsWith('/login')
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/projects', req.url))
  }
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
```

---

## 8. UI Architecture

### Principles
- **No business logic in components.** Components call API routes. API routes call `packages/core`.
- **No modals for create/edit.** Use dedicated pages (`/projects/new`, `/projects/[id]/edit`).
- **Tables everywhere.** Use TanStack Table + shadcn `<Table>` for all list views.
- **Simple, functional.** No fancy animations. Data density over visual flair.

### Shared UI Components (packages/ui)

```
packages/ui/src/components/
├── data-table.tsx          # Generic TanStack Table wrapper
├── data-table-toolbar.tsx  # Search input + filter dropdowns
├── status-badge.tsx        # Pill with color from project_statuses
├── custom-fields-form.tsx  # Renders fields dynamically from definitions
├── activity-feed.tsx       # Renders events list for an entity
└── page-header.tsx         # Title + breadcrumb + action button
```

### Page Structure

```
/projects                   → Table: Name | Client | Status | Address | Date
/projects/new               → Form: required fields + custom fields
/projects/[id]              → Tabs:
                                Overview: all fields, client card, members
                                Reports: list of reports, add report button
                                Activity: events feed for this project
/companies                  → Table: Name | Industry | # Contacts | # Projects
/companies/[id]             → Overview + linked contacts + linked projects
/contacts                   → Table: Name | Company | Type | Email | Phone
/contacts/[id]              → Overview + linked projects
/settings/custom-fields     → Table per entity type, add/deactivate fields
/settings/statuses          → Drag-to-reorder list, add/edit/deactivate
```

### Custom Fields Rendering

```typescript
// packages/ui/src/components/custom-fields-form.tsx
// Receives: definitions[] from API, currentValues from record
// For each definition: renders appropriate input (text, number, date, select, checkbox)
// Empty for old records is fine – shows placeholder, saves on change
// On save: PATCH /api/v1/projects/[id] with { custom_properties: { [name]: value } }
// API uses JSONB merge: SET custom_properties = custom_properties || $newValues
```

---

## 9. Environment Variables

```bash
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres
```

---

## 10. Key Rules – Never Break These

| Rule | Detail |
|---|---|
| **No hard deletes** | Always `SET deleted_at = NOW()`. Never `DELETE FROM`. |
| **No mutation without event** | Every write calls `emitEvent()` in the same transaction. |
| **No business logic in routes** | Routes: auth → parse → call core → respond. |
| **No business logic in components** | Components call API routes only. |
| **Custom fields always optional** | New fields use `.optional()` in Zod. Old records stay valid. |
| **Org isolation always** | Every query scoped to `org_id`. RLS is the safety net, not the only guard. |
| **Phone numbers E.164** | `+491234567890` format enforced at DB level. |
| **Status type in system enum** | App logic uses `status_type` (OPEN etc.), never org label strings. |

---

## 11. Implementation Order for Claude Code

Execute in this order. Do not start a phase until the previous is complete and tested.

1. **Turborepo scaffold** – `packages/config` with tsconfig/eslint/prettier
2. **`packages/db`** – Drizzle schema mirroring all SQL migrations, Supabase client
3. **Run all SQL migrations** on Supabase (in order 001–015)
4. **`packages/core`** – `emitEvent`, Zod schemas, all mutation functions
5. **`packages/ui`** – Install shadcn/ui, build `data-table`, `status-badge`, `custom-fields-form`, `activity-feed`
6. **`apps/web` auth** – Login page, middleware, `getOrgContext`
7. **API routes** – All routes under `/api/v1/` (projects first, then companies, contacts, admin)
8. **UI pages** – Projects list → Project detail → Companies → Contacts → Settings
9. **Supabase Storage** – Bucket for report images, upload/delete logic in report routes
10. **End-to-end test** – Create org + user in Supabase Dashboard, log in, create project with custom fields, add report with image, check activity feed
