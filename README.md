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

## LLM Evals

The `evals/` folder contains a [Promptfoo](https://promptfoo.dev) test suite for the AI agent. Tests run against real LLMs with a mocked API backend (fixture data, no database needed).

### Run evals

```bash
# Run all tests in the terminal
npm run eval

# Run and open the browser UI
npm run eval:ui

# Open the browser UI for the last run (without re-running)
npx promptfoo view
```

### Browser UI

`npm run eval:ui` (or `npx promptfoo view`) opens **http://localhost:15500** with:
- Side-by-side comparison table across all tested models
- Pass/fail breakdown per test and per assertion
- Full model outputs for each test case

### Adding a test

Tests live in `evals/promptfooconfig.yaml`. Each test has a `message` (the user turn), optional `history` (prior conversation turns to simulate mid-conversation state), and `assert` checks.

```yaml
- description: what this test verifies
  vars:
    message: "User message in German"
  assert:
    # Check a tool was called
    - type: javascript
      value: "JSON.parse(output).toolsCalled.includes('list_projects')"
    # Check text content (single-line — no return needed)
    - type: javascript
      value: "output.toLowerCase().includes('mehrhaus')"
    # Multi-line assertions need explicit return
    - type: javascript
      value: |
        const { toolsCalled } = JSON.parse(output)
        return toolsCalled.includes('list_projects') && toolsCalled.includes('create_report')
    # Case-insensitive substring match in the text reply
    - type: icontains
      value: "Tagesbericht"
```

The `output` variable in JavaScript assertions is a JSON string. Parse it to access:
- `JSON.parse(output).text` — the model's text reply
- `JSON.parse(output).toolsCalled` — ordered array of tool names called (e.g. `["list_projects", "create_report"]`)
- `JSON.parse(output).toolArgs` — last args per tool name

### Testing multiple LLMs

Add entries to the `providers` list in `promptfooconfig.yaml`. Every test runs against every provider and results appear side by side in the UI.

```yaml
providers:
  - id: "file://provider.ts"
    label: "Gemini 2.5 Flash"
    config:
      provider: google
      model: gemini-2.5-flash
  - id: "file://provider.ts"
    label: "Groq Llama 3.3 70B"
    config:
      provider: groq
      model: llama-3.3-70b-versatile
```

Supported providers: `google` (requires `GOOGLE_API_KEY`), `groq` (requires `GROQ_API_KEY`), `anthropic` (requires `ANTHROPIC_API_KEY` + `npm install @ai-sdk/anthropic`).

### Fixture data

`evals/fixtures.ts` contains the hardcoded projects, reports, and stubs returned by the mock backend. Edit these to match realistic test data — the mock intercepts all `http://mock/api/v1/...` calls so no real database is involved.
