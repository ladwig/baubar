-- ============================================================
-- project_management schema: full baseline
-- ============================================================

CREATE SCHEMA IF NOT EXISTS project_management;
GRANT USAGE ON SCHEMA project_management TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA project_management TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA project_management
  GRANT ALL ON TABLES TO authenticated;


-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE project_management.status_type AS ENUM (
  'OPEN', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'DONE'
);


-- ============================================================
-- Organizations
-- ============================================================
CREATE TABLE project_management.organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);


-- ============================================================
-- Users (mirrors auth.users 1:1)
-- ============================================================
CREATE TABLE project_management.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- Org Members
-- ============================================================
CREATE TABLE project_management.org_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES project_management.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'worker',
  deleted_at TIMESTAMPTZ,
  UNIQUE(org_id, user_id)
);


-- ============================================================
-- Project Statuses
-- ============================================================
CREATE TABLE project_management.project_statuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  status_type project_management.status_type NOT NULL,
  color       TEXT DEFAULT '#6B7280',
  sort_order  INT DEFAULT 0,
  is_default  BOOLEAN DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ,
  UNIQUE(org_id, label)
);

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
-- Custom Field Definitions
-- ============================================================
CREATE TABLE project_management.custom_field_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'company', 'contact', 'report')),
  name        TEXT NOT NULL,
  label       TEXT NOT NULL,
  field_type  TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'select')),
  options     JSONB,
  sort_order  INT DEFAULT 0,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, entity_type, name)
);


-- ============================================================
-- Companies
-- ============================================================
CREATE TABLE project_management.companies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  address           TEXT,
  industry          TEXT,
  custom_properties JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_companies_custom ON project_management.companies USING GIN (custom_properties);


-- ============================================================
-- Contacts
-- ============================================================
CREATE TABLE project_management.contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES project_management.companies(id) ON DELETE SET NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT CHECK (phone ~ '^\+[1-9]\d{6,14}$' OR phone IS NULL),
  contact_type      TEXT,
  custom_properties JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_contacts_custom ON project_management.contacts USING GIN (custom_properties);


-- ============================================================
-- Projects
-- ============================================================
CREATE TABLE project_management.projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES project_management.companies(id) ON DELETE SET NULL,
  contact_id        UUID REFERENCES project_management.contacts(id) ON DELETE SET NULL,
  status_id         UUID REFERENCES project_management.project_statuses(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  address           TEXT,
  planned_hours     DECIMAL DEFAULT 0.0,
  custom_properties JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT project_must_have_client CHECK (
    company_id IS NOT NULL OR contact_id IS NOT NULL
  )
);

CREATE INDEX idx_projects_custom ON project_management.projects USING GIN (custom_properties);
CREATE INDEX idx_projects_org_status ON project_management.projects(org_id, status_id);


-- ============================================================
-- Project Members
-- ============================================================
CREATE TABLE project_management.project_members (
  project_id UUID NOT NULL REFERENCES project_management.projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES project_management.users(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'worker',
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (project_id, user_id)
);


-- ============================================================
-- Project Reports
-- ============================================================
CREATE TABLE project_management.project_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES project_management.organizations(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES project_management.projects(id) ON DELETE CASCADE,
  author_id         UUID REFERENCES project_management.users(id),
  report_type       TEXT NOT NULL,
  text_content      TEXT,
  custom_properties JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);


-- ============================================================
-- Report Images
-- ============================================================
CREATE TABLE project_management.report_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    UUID NOT NULL REFERENCES project_management.project_reports(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_by  UUID REFERENCES project_management.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- Report Comments
-- ============================================================
CREATE TABLE project_management.report_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES project_management.project_reports(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES project_management.users(id),
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);


-- ============================================================
-- Events (audit log + event bus)
-- ============================================================
CREATE TABLE project_management.events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES project_management.organizations(id),
  actor_id     UUID REFERENCES project_management.users(id),
  event_type   TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  summary      TEXT,
  changes      JSONB,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_events_entity ON project_management.events(entity_type, entity_id);
CREATE INDEX idx_events_org_time ON project_management.events(org_id, created_at DESC);


-- ============================================================
-- Row Level Security
-- ============================================================
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

CREATE OR REPLACE FUNCTION project_management.current_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM project_management.org_members
  WHERE user_id = auth.uid() AND deleted_at IS NULL
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "org_isolation" ON project_management.organizations
  USING (id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.org_members
  USING (user_id = auth.uid() OR org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "users_in_same_org" ON project_management.users
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM project_management.org_members
      WHERE org_id IN (SELECT project_management.current_user_org_ids())
    )
  );

CREATE POLICY "org_isolation" ON project_management.project_statuses
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.custom_field_definitions
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.companies
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.contacts
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.projects
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.project_members
  USING (project_id IN (
    SELECT id FROM project_management.projects
    WHERE org_id IN (SELECT project_management.current_user_org_ids())
  ));

CREATE POLICY "org_isolation" ON project_management.project_reports
  USING (org_id IN (SELECT project_management.current_user_org_ids()));

CREATE POLICY "org_isolation" ON project_management.report_images
  USING (report_id IN (
    SELECT id FROM project_management.project_reports
    WHERE org_id IN (SELECT project_management.current_user_org_ids())
  ));

CREATE POLICY "org_isolation" ON project_management.report_comments
  USING (report_id IN (
    SELECT id FROM project_management.project_reports
    WHERE org_id IN (SELECT project_management.current_user_org_ids())
  ));

CREATE POLICY "org_isolation" ON project_management.events
  USING (org_id IN (SELECT project_management.current_user_org_ids()));
