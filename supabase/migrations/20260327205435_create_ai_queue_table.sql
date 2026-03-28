-- ============================================================
-- AI queue table (background job processing)
-- ============================================================

CREATE TABLE ai.queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event        TEXT NOT NULL,
  payload      JSONB NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts     INT NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_queue_pending ON ai.queue(status, created_at)
  WHERE status = 'pending';
