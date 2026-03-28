-- ============================================================
-- AI schema: threads, messages, configs
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ai;
GRANT USAGE ON SCHEMA ai TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA ai TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA ai
  GRANT ALL ON TABLES TO authenticated;

CREATE TABLE ai.threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp', 'mobile')),
  external_id TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, channel, external_id)
);

CREATE TABLE ai.messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES ai.threads(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_thread ON ai.messages(thread_id, created_at);

CREATE TABLE ai.configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL UNIQUE REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  system_prompt TEXT,
  language      TEXT DEFAULT 'de',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ai.threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai.configs  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON ai.threads
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON ai.messages
  USING (thread_id IN (
    SELECT id FROM ai.threads
    WHERE org_id IN (SELECT project_management.current_user_org_ids())
  ));

CREATE POLICY "org_isolation" ON ai.configs
  USING (org_id IN (SELECT project_management.current_user_org_ids()));
