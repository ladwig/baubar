-- ============================================================
-- AI queue worker functions
-- ============================================================

-- Atomically claim the next pending job (SKIP LOCKED prevents double-processing)
CREATE OR REPLACE FUNCTION ai.claim_queue_job()
RETURNS ai.queue AS $$
  UPDATE ai.queue
  SET status = 'processing', attempts = attempts + 1
  WHERE id = (
    SELECT id FROM ai.queue
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;

-- Mark a job as failed (or re-queue it if under max_attempts)
CREATE OR REPLACE FUNCTION ai.fail_queue_job(
  job_id       UUID,
  error_msg    TEXT,
  max_attempts INT
)
RETURNS VOID AS $$
  UPDATE ai.queue
  SET
    status       = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
    error        = error_msg,
    processed_at = CASE WHEN attempts >= max_attempts THEN NOW() ELSE NULL END
  WHERE id = job_id;
$$ LANGUAGE sql;
