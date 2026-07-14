-- Migration: first-class agent surface on the task queue
--
-- Replaces the magic 'bobwork' tag with an explicit assignee, adds a 'review'
-- status so Bob's finished work lands in an inbox instead of self-closing,
-- gives tasks an append-only event log (Bob stops overwriting notes), and adds
-- actor attribution to the business activity log.
--
-- Rollback: ALTER TABLE wpa.wpa_tasks DROP COLUMN assigned_to;
--           DROP TABLE wpa.wpa_task_events;
--           ALTER TABLE wpa.wpa_activity DROP COLUMN actor;
--           (restore prior wpa_tasks_status_check without 'review')

-- 1. Explicit assignment
ALTER TABLE wpa.wpa_tasks
  ADD COLUMN assigned_to TEXT NOT NULL DEFAULT 'human'
  CHECK (assigned_to IN ('human', 'bob'));

CREATE INDEX idx_wpa_tasks_assigned
  ON wpa.wpa_tasks (assigned_to)
  WHERE status <> 'done';

-- Backfill from the bobwork tag convention (tags keep working in parallel
-- until Bob's skill is cut over to assigned_to)
UPDATE wpa.wpa_tasks
SET assigned_to = 'bob'
WHERE tags @> ARRAY['bobwork'];

-- 2. Review gate: Bob finishes into 'review'; the owner closes to 'done'
ALTER TABLE wpa.wpa_tasks DROP CONSTRAINT IF EXISTS wpa_tasks_status_check;
ALTER TABLE wpa.wpa_tasks ADD CONSTRAINT wpa_tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'blocked', 'review', 'done'));

-- 3. Append-only task history (comments, status changes, agent runs)
CREATE TABLE wpa.wpa_task_events (
  id         BIGSERIAL PRIMARY KEY,
  task_id    BIGINT NOT NULL REFERENCES wpa.wpa_tasks(id) ON DELETE CASCADE,
  actor      TEXT NOT NULL DEFAULT 'human',
  kind       TEXT NOT NULL DEFAULT 'comment'
    CHECK (kind IN ('comment', 'status_change', 'assignment', 'agent_run')),
  body       TEXT NOT NULL DEFAULT '',
  meta       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_events_task ON wpa.wpa_task_events (task_id, created_at);

-- Matches the current access posture (tightened in the new-project lockdown)
ALTER TABLE wpa.wpa_task_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_full_access" ON wpa.wpa_task_events
  FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON wpa.wpa_task_events TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE wpa.wpa_task_events_id_seq TO anon, authenticated;

-- 4. Actor attribution on the business activity log
ALTER TABLE wpa.wpa_activity
  ADD COLUMN actor TEXT NOT NULL DEFAULT 'human';

-- 'Stage moved to …' rows could only come from the move_to_stage RPC, which
-- only the agent calls (the UI updates contact_status directly). Conversion
-- rows are a human/agent mix, so they keep the 'human' default.
UPDATE wpa.wpa_activity
SET actor = 'bob'
WHERE type = 'stage_change' AND summary LIKE 'Stage moved to %';
