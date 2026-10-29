-- Rewrite non-empty phones in wpa to +1 and ten digits, then lock the column.
-- Leave empty phones empty. Fail if any non-empty phone does not normalize.
-- Do not apply this file from the app host. Do not db push. public is not rewritten.

CREATE OR REPLACE FUNCTION wpa._phone_e164_normalize(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN '';
  END IF;
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  IF length(digits) = 11 AND left(digits, 1) = '1' THEN
    digits := substring(digits FROM 2);
  END IF;
  IF length(digits) = 10 THEN
    RETURN '+1' || digits;
  END IF;
  -- Non-empty input that is not ten digits must fail the migration, not blank to ''.
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM (
    SELECT phone
    FROM wpa.wpa_businesses
    WHERE phone IS NOT NULL
      AND btrim(phone) <> ''
      AND wpa._phone_e164_normalize(phone) IS NULL
    UNION ALL
    SELECT phone
    FROM wpa.wpa_contacts
    WHERE phone IS NOT NULL
      AND btrim(phone) <> ''
      AND wpa._phone_e164_normalize(phone) IS NULL
  ) bad;

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'phone_e164: % non-empty phone values do not normalize', bad_count;
  END IF;

  UPDATE wpa.wpa_businesses
  SET phone = '',
      updated_at = now()
  WHERE phone IS NOT NULL
    AND btrim(phone) = ''
    AND phone <> '';

  UPDATE wpa.wpa_contacts
  SET phone = '',
      updated_at = now()
  WHERE phone IS NOT NULL
    AND btrim(phone) = ''
    AND phone <> '';

  UPDATE wpa.wpa_businesses
  SET phone = wpa._phone_e164_normalize(phone),
      updated_at = now()
  WHERE phone IS NOT NULL
    AND btrim(phone) <> ''
    AND wpa._phone_e164_normalize(phone) IS NOT NULL
    AND phone IS DISTINCT FROM wpa._phone_e164_normalize(phone);

  UPDATE wpa.wpa_contacts
  SET phone = wpa._phone_e164_normalize(phone),
      updated_at = now()
  WHERE phone IS NOT NULL
    AND btrim(phone) <> ''
    AND wpa._phone_e164_normalize(phone) IS NOT NULL
    AND phone IS DISTINCT FROM wpa._phone_e164_normalize(phone);
END $$;

ALTER TABLE wpa.wpa_businesses
  DROP CONSTRAINT IF EXISTS wpa_businesses_phone_e164_check;

ALTER TABLE wpa.wpa_businesses
  ADD CONSTRAINT wpa_businesses_phone_e164_check
  CHECK (phone IS NULL OR phone = '' OR phone ~ '^\+1[0-9]{10}$');

ALTER TABLE wpa.wpa_contacts
  DROP CONSTRAINT IF EXISTS wpa_contacts_phone_e164_check;

ALTER TABLE wpa.wpa_contacts
  ADD CONSTRAINT wpa_contacts_phone_e164_check
  CHECK (phone IS NULL OR phone = '' OR phone ~ '^\+1[0-9]{10}$');

DROP FUNCTION wpa._phone_e164_normalize(text);
