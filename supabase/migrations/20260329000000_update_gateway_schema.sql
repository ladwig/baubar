-- ============================================================
-- Update gateway schema:
--   1. Rename company_numbers → org_numbers (orgs, not companies)
--   2. Rename FK column in conversations
--   3. Add thread_id to conversations (link to AI context)
--   4. Add allowed_contacts whitelist (only approved contacts can chat with AI)
-- ============================================================

-- 1. Rename table
ALTER TABLE gateway.company_numbers RENAME TO org_numbers;

-- 2. Rename FK column in conversations
ALTER TABLE gateway.conversations RENAME COLUMN company_number_id TO org_number_id;

-- 3. Link conversations to AI thread
ALTER TABLE gateway.conversations
  ADD COLUMN thread_id UUID REFERENCES ai.threads(id) ON DELETE SET NULL;

-- 4. Whitelist of contacts allowed to interact with the AI via WhatsApp
CREATE TABLE gateway.allowed_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_id    UUID REFERENCES project_management.contacts(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID REFERENCES project_management.users(id) ON DELETE SET NULL,
  UNIQUE(org_id, contact_phone)
);

ALTER TABLE gateway.allowed_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON gateway.allowed_contacts
  USING (org_id IN (SELECT project_management.current_user_org_ids()));
