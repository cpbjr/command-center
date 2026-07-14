-- Migration: updated_at triggers for all wpa tables
-- Every updated_at column was DEFAULT now() on INSERT only — REST PATCHes
-- (Bob's primary write path) never bumped it, so "what changed since X"
-- polling was unreliable.
-- Rollback: DROP FUNCTION wpa.set_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION wpa.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach to every base table in wpa that has an updated_at column
-- (currently: wpa_businesses, wpa_tasks, wpa_projects, wpa_contacts, wpa_contracts).
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'wpa'
      AND c.column_name = 'updated_at'
      AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON wpa.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON wpa.%I
         FOR EACH ROW EXECUTE FUNCTION wpa.set_updated_at()', t);
  END LOOP;
END $$;
