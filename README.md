# baubar

Project management for construction — built for the office and the field.

The web app gives office teams a structured interface to manage projects, reports, companies, and contacts. Field workers will soon interact with the same data through WhatsApp, using an AI assistant that understands natural language and can look things up or create entries on their behalf.

## Stack

- **Next.js 14** (App Router) — web UI and REST API
- **Supabase** — PostgreSQL, auth, file storage
- **Drizzle ORM** — type-safe DB access
- **Turborepo** — monorepo build system
- **Vercel AI SDK** + **Google Gemini** — AI assistant and tool calling
- **Hono** — lightweight HTTP server for the agent service

## Monorepo structure

```
apps/
  web/        # Next.js app — UI + REST API (/api/v1/...)
  agent/      # AI agent service (port 3001) — LLM, tools, conversation threads
  gateway/    # Messaging gateway — WhatsApp and future channels (stub)
packages/
  ai/         # Shared AI tools, system prompt, agent runner
  db/         # Drizzle schema + Supabase client
  core/       # Zod schemas, mutations, event emitter
  ui/         # Shared shadcn/ui components
  config/     # Shared tsconfig / eslint / prettier
```

## How it fits together

```
Browser  →  apps/web  ──────────────────────────────→  REST API
                │                                           ↑
                └→  apps/agent (LLM + tools)  ────────────┘
                         ↑
WhatsApp  →  apps/gateway  ┘
```

The agent is channel-agnostic — the same LLM and tools power the web chat bubble today and will power the WhatsApp integration tomorrow.

## Getting started

### Prerequisites

- Node.js 20+
- Supabase project
- Google AI API key

### Setup

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
cp apps/agent/.env.example apps/agent/.env.local
```

Run the SQL migrations from `CLAUDE.md` against your Supabase project, fill in the env files, then:

```bash
npm run dev --workspace=apps/web    # port 3000
npm run dev --workspace=apps/agent  # port 3001
```

### Environment variables

**`apps/web/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
AGENT_SERVICE_URL=http://localhost:3001
```

**`apps/agent/.env.local`**
```
PORT=3001
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
GOOGLE_API_KEY=
GROQ_API_KEY=
WEB_API_BASE=http://localhost:3000
```
