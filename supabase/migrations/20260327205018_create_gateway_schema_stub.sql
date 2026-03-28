-- ============================================================
-- Gateway schema: WhatsApp/messaging gateway tables
-- ============================================================

CREATE SCHEMA IF NOT EXISTS gateway;
GRANT USAGE ON SCHEMA gateway TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA gateway TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA gateway
  GRANT ALL ON TABLES TO authenticated;

CREATE TABLE gateway.company_numbers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  phone_number       TEXT NOT NULL,
  provider           TEXT NOT NULL CHECK (provider IN ('twilio', 'meta')),
  provider_number_id TEXT NOT NULL,
  display_name       TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at     TIMESTAMPTZ,
  UNIQUE(phone_number, provider)
);

CREATE TABLE gateway.conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  company_number_id UUID NOT NULL REFERENCES gateway.company_numbers(id) ON DELETE CASCADE,
  contact_phone     TEXT,
  group_id          TEXT,
  type              TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  last_message_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at    TIMESTAMPTZ
);

CREATE TABLE gateway.messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES gateway.conversations(id) ON DELETE CASCADE,
  direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number         TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('text', 'image', 'audio', 'document', 'location')),
  content             TEXT,
  media_storage_url   TEXT,
  mime_type           TEXT,
  provider_message_id TEXT,
  sent_at             TIMESTAMPTZ DEFAULT NOW(),
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  error_code          TEXT
);

CREATE INDEX idx_gateway_messages_conv ON gateway.messages(conversation_id, sent_at);

CREATE TABLE gateway.webhook_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  url            TEXT NOT NULL,
  secret         TEXT NOT NULL,
  events         TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ
);

CREATE TABLE gateway.webhook_delivery_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES gateway.webhook_subscriptions(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  payload         JSONB NOT NULL,
  attempt         INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  response_code   INT,
  sent_at         TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE gateway.company_numbers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway.conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway.webhook_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON gateway.company_numbers
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON gateway.conversations
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON gateway.messages
  USING (conversation_id IN (
    SELECT id FROM gateway.conversations
    WHERE org_id IN (SELECT project_management.current_user_org_ids())
  ));

CREATE POLICY "org_isolation" ON gateway.webhook_subscriptions
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON gateway.webhook_delivery_log
  USING (subscription_id IN (
    SELECT id FROM gateway.webhook_subscriptions
    WHERE org_id IN (SELECT project_management.current_user_org_ids())
  ));
