-- Snapshot of legacy public + crm schema objects before cleanup (2026-07-14)
-- Captured for recovery. CC app uses wpa schema exclusively.

-- ===== public schema DDL =====


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."execute_sql"("query_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE query_text INTO result;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."execute_sql"("query_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_avatar_for_email"("email" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$declare email_hash text;
declare gravatar_url text;
declare gravatar_status int8;
declare email_domain text;
declare favicon_url text;
declare domain_status int8;

begin
    -- Try to fetch a gravatar image
    email_hash = encode(digest(email, 'sha256'), 'hex');
    gravatar_url = concat('https://www.gravatar.com/avatar/', email_hash, '?d=404');

    select status from http_get(gravatar_url) into gravatar_status;

    if gravatar_status = 200 then
        return gravatar_url;
    end if;

    -- Fallback to email's domain favicon if not excluded
    email_domain = split_part(email, '@', 2);
    return get_domain_favicon(email_domain);
exception
    when others then
        return 'ERROR';
end;$$;


ALTER FUNCTION "public"."get_avatar_for_email"("email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_domain_favicon"("domain_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$declare domain_status int8;

begin
    if exists (select from favicons_excluded_domains as fav where fav.domain = domain_name) then
        return null;
    end if;

    return concat(
        'https://favicon.show/',
        (regexp_matches(domain_name, '^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)', 'i'))[1]
    );
end;$$;


ALTER FUNCTION "public"."get_domain_favicon"("domain_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("email" "text") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY SELECT au.id FROM auth.users au WHERE au.email = $1;
END;
$_$;


ALTER FUNCTION "public"."get_user_id_by_email"("email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_company_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$declare company_logo text;

begin
    if new.logo is not null then
        return new;
    end if;

    company_logo = get_domain_favicon(new.website);
    if company_logo is null then
        return new;
    end if;

    new.logo = concat('{"src":"', company_logo, '","title":"Company favicon"}');
    return new;
end;$$;


ALTER FUNCTION "public"."handle_company_saved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_contact_note_created_or_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.contacts set last_seen = new.date where contacts.id = new.contact_id and contacts.last_seen < new.date;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_contact_note_created_or_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_contact_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$declare contact_avatar text;
declare emails_length int8;
declare item jsonb;

begin
    if new.avatar is not null then
        return new;
    end if;

    select coalesce(jsonb_array_length(new.email_jsonb), 0) into emails_length;

    if emails_length = 0 then
        return new;
    end if;

    for item in select jsonb_array_elements(new.email_jsonb)
    loop
        select public.get_avatar_for_email(item->>'email') into contact_avatar;
        if (contact_avatar is not null) then
            exit;
        end if;
    end loop;

    if contact_avatar is null then
        return new;
    end if;

    new.avatar = concat('{"src":"', contact_avatar, '"}');
    return new;
end;$$;


ALTER FUNCTION "public"."handle_contact_saved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM crm.sales WHERE user_id = auth.uid() AND administrator = TRUE
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_contacts"("loser_id" bigint, "winner_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'crm'
    AS $$
DECLARE
  winner_contact crm.contacts%ROWTYPE;
  loser_contact crm.contacts%ROWTYPE;
  deal_record RECORD;
  merged_emails jsonb;
  merged_phones jsonb;
  merged_tags bigint[];
  winner_emails jsonb;
  loser_emails jsonb;
  winner_phones jsonb;
  loser_phones jsonb;
  email_map jsonb;
  phone_map jsonb;
BEGIN
  -- Fetch both contacts
  SELECT * INTO winner_contact FROM crm.contacts WHERE id = winner_id;
  SELECT * INTO loser_contact FROM crm.contacts WHERE id = loser_id;

  IF winner_contact IS NULL OR loser_contact IS NULL THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- 1. Reassign tasks from loser to winner
  UPDATE crm.tasks SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 2. Reassign contact notes from loser to winner
  UPDATE crm.contact_notes SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 3. Update deals - replace loser with winner in contact_ids array
  FOR deal_record IN
    SELECT id, contact_ids
    FROM crm.deals
    WHERE contact_ids @> ARRAY[loser_id]
  LOOP
    UPDATE crm.deals
    SET contact_ids = (
      SELECT ARRAY(
        SELECT DISTINCT unnest(
          array_remove(deal_record.contact_ids, loser_id) || ARRAY[winner_id]
        )
      )
    )
    WHERE id = deal_record.id;
  END LOOP;

  -- 4. Merge contact data

  -- Get email arrays
  winner_emails := COALESCE(winner_contact.email_jsonb, '[]'::jsonb);
  loser_emails := COALESCE(loser_contact.email_jsonb, '[]'::jsonb);

  -- Merge emails with deduplication by email address
  email_map := '{}'::jsonb;

  IF jsonb_array_length(winner_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_emails)-1 LOOP
      email_map := email_map || jsonb_build_object(
        winner_emails->i->>'email',
        winner_emails->i
      );
    END LOOP;
  END IF;

  IF jsonb_array_length(loser_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_emails)-1 LOOP
      IF NOT email_map ? (loser_emails->i->>'email') THEN
        email_map := email_map || jsonb_build_object(
          loser_emails->i->>'email',
          loser_emails->i
        );
      END IF;
    END LOOP;
  END IF;

  merged_emails := (SELECT jsonb_agg(value) FROM jsonb_each(email_map));
  merged_emails := COALESCE(merged_emails, '[]'::jsonb);

  -- Get phone arrays
  winner_phones := COALESCE(winner_contact.phone_jsonb, '[]'::jsonb);
  loser_phones := COALESCE(loser_contact.phone_jsonb, '[]'::jsonb);

  -- Merge phones with deduplication by number
  phone_map := '{}'::jsonb;

  IF jsonb_array_length(winner_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_phones)-1 LOOP
      phone_map := phone_map || jsonb_build_object(
        winner_phones->i->>'number',
        winner_phones->i
      );
    END LOOP;
  END IF;

  IF jsonb_array_length(loser_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_phones)-1 LOOP
      IF NOT phone_map ? (loser_phones->i->>'number') THEN
        phone_map := phone_map || jsonb_build_object(
          loser_phones->i->>'number',
          loser_phones->i
        );
      END IF;
    END LOOP;
  END IF;

  merged_phones := (SELECT jsonb_agg(value) FROM jsonb_each(phone_map));
  merged_phones := COALESCE(merged_phones, '[]'::jsonb);

  -- Merge tags (remove duplicates)
  merged_tags := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(winner_contact.tags, ARRAY[]::bigint[]) ||
      COALESCE(loser_contact.tags, ARRAY[]::bigint[])
    )
  );

  -- 5. Update winner with merged data
  UPDATE crm.contacts SET
    avatar = COALESCE(winner_contact.avatar, loser_contact.avatar),
    gender = COALESCE(winner_contact.gender, loser_contact.gender),
    first_name = COALESCE(winner_contact.first_name, loser_contact.first_name),
    last_name = COALESCE(winner_contact.last_name, loser_contact.last_name),
    title = COALESCE(winner_contact.title, loser_contact.title),
    company_id = COALESCE(winner_contact.company_id, loser_contact.company_id),
    email_jsonb = merged_emails,
    phone_jsonb = merged_phones,
    linkedin_url = COALESCE(winner_contact.linkedin_url, loser_contact.linkedin_url),
    background = COALESCE(winner_contact.background, loser_contact.background),
    has_newsletter = COALESCE(winner_contact.has_newsletter, loser_contact.has_newsletter),
    first_seen = LEAST(COALESCE(winner_contact.first_seen, loser_contact.first_seen), COALESCE(loser_contact.first_seen, winner_contact.first_seen)),
    last_seen = GREATEST(COALESCE(winner_contact.last_seen, loser_contact.last_seen), COALESCE(loser_contact.last_seen, winner_contact.last_seen)),
    sales_id = COALESCE(winner_contact.sales_id, loser_contact.sales_id),
    tags = merged_tags
  WHERE id = winner_id;

  -- 6. Delete loser contact
  DELETE FROM crm.contacts WHERE id = loser_id;

  RETURN winner_id;
END;
$$;


ALTER FUNCTION "public"."merge_contacts"("loser_id" bigint, "winner_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_sales_id_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.sales_id IS NULL THEN
    SELECT id INTO NEW.sales_id FROM crm.sales WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_sales_id_default"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_winnow_outcome_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only fire when contact_status actually changes
  IF OLD.contact_status IS DISTINCT FROM NEW.contact_status THEN
    -- Map contact_status to outcome
    IF NEW.contact_status IN ('CONTACTED', 'REPLIED', 'CLOSED-WON', 'CLOSED') THEN
      UPDATE public.winnow_decisions
      SET
        outcome_actual = NEW.contact_status,
        outcome_updated_at = now()
      WHERE
        business_id = NEW.id
        AND outcome_actual IS NULL
        AND id = (
          SELECT id FROM public.winnow_decisions
          WHERE business_id = NEW.id
          ORDER BY decided_at DESC
          LIMIT 1
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_winnow_outcome_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'maintenance_log', 'pg_temp'
    AS $$
BEGIN
  -- Update with schema-qualified table name
  UPDATE maintenance_log.authorized_users
  SET
    last_message_date = NOW(),
    message_count = message_count + 1,
    updated_at = NOW()
  WHERE telegram_id = NEW.sender_telegram_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_activity"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audits" (
    "id" bigint NOT NULL,
    "business_id" "text" NOT NULL,
    "has_schema" boolean DEFAULT false,
    "has_sameas" boolean DEFAULT false,
    "category_aligned" boolean DEFAULT false,
    "nap_consistent" boolean DEFAULT false,
    "mobile_speed_score" integer,
    "mobile_lcp" numeric(10,2),
    "raw_schema" "jsonb",
    "issues" "jsonb" DEFAULT '[]'::"jsonb",
    "score" integer,
    "audited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hosting_provider" "text",
    "hosting_cost_min" integer,
    "hosting_cost_max" integer,
    "hosting_savings_min" integer,
    "hosting_savings_max" integer,
    "pitch_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audits_mobile_speed_score_check" CHECK ((("mobile_speed_score" >= 0) AND ("mobile_speed_score" <= 100))),
    CONSTRAINT "audits_score_check" CHECK ((("score" >= 0) AND ("score" <= 5)))
);


ALTER TABLE "public"."audits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audits_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audits_id_seq" OWNED BY "public"."audits"."id";



CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text",
    "website_url" "text" DEFAULT ''::"text",
    "gbp_categories" "jsonb" DEFAULT '[]'::"jsonb",
    "search_query" "text" DEFAULT ''::"text" NOT NULL,
    "discovered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_status" "text" DEFAULT 'NEW'::"text" NOT NULL,
    "discovery_rank" integer,
    "rank_total_candidates" integer,
    "google_maps_uri" "text" DEFAULT ''::"text",
    "business_status" "text" DEFAULT ''::"text",
    "rating" numeric(3,2),
    "user_rating_count" integer,
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "folder_path" "text",
    CONSTRAINT "businesses_contact_status_check" CHECK (("contact_status" = ANY (ARRAY['NEW'::"text", 'CONTACTED'::"text", 'REPLIED'::"text", 'CLOSED'::"text", 'CLOSED-WON'::"text"])))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."businesses"."folder_path" IS 'File server path relative to /files/ root, e.g. WhitePineAgency/Clients/Leads/Goodrich-Plumbing-Idaho';



CREATE OR REPLACE VIEW "public"."businesses_with_crm_status" AS
 SELECT "b"."id",
    "b"."name",
    "b"."address",
    "b"."phone",
    "b"."website_url",
    "b"."gbp_categories",
    "b"."search_query",
    "b"."discovered_at",
    "b"."contact_status",
    "b"."discovery_rank",
    "b"."rank_total_candidates",
    "b"."google_maps_uri",
    "b"."business_status",
    "b"."rating",
    "b"."user_rating_count",
    "b"."raw_data",
    "b"."created_at",
    "b"."updated_at",
    "c"."id" AS "crm_company_id",
    ("c"."id" IS NOT NULL) AS "in_crm"
   FROM ("wpa"."wpa_businesses" "b"
     LEFT JOIN "crm"."companies" "c" ON (("c"."business_id" = "b"."id")));


ALTER VIEW "public"."businesses_with_crm_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."businesses_with_score" AS
 SELECT "b"."id",
    "b"."name",
    "b"."address",
    "b"."phone",
    "b"."website_url",
    "b"."gbp_categories",
    "b"."search_query",
    "b"."discovered_at",
    "b"."contact_status",
    "b"."discovery_rank",
    "b"."rank_total_candidates",
    "b"."google_maps_uri",
    "b"."business_status",
    "b"."rating",
    "b"."user_rating_count",
    "b"."raw_data",
    "b"."created_at",
    "b"."updated_at",
    "a"."score" AS "latest_score"
   FROM ("public"."businesses" "b"
     LEFT JOIN LATERAL ( SELECT "audits"."score"
           FROM "public"."audits"
          WHERE ("audits"."business_id" = "b"."id")
          ORDER BY "audits"."audited_at" DESC
         LIMIT 1) "a" ON (true));


ALTER VIEW "public"."businesses_with_score" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."companies" WITH ("security_invoker"='on') AS
 SELECT "id",
    "created_at",
    "name",
    "sector",
    "size",
    "linkedin_url",
    "website",
    "phone_number",
    "address",
    "zipcode",
    "city",
    "state_abbr",
    "sales_id",
    "context_links",
    "country",
    "description",
    "revenue",
    "tax_identifier",
    "logo",
    "business_id"
   FROM "crm"."companies";


ALTER VIEW "public"."companies" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."companies_summary" WITH ("security_invoker"='on') AS
 SELECT "id",
    "created_at",
    "name",
    "sector",
    "size",
    "linkedin_url",
    "website",
    "phone_number",
    "address",
    "zipcode",
    "city",
    "state_abbr",
    "sales_id",
    "context_links",
    "country",
    "description",
    "revenue",
    "tax_identifier",
    "logo",
    "nb_deals",
    "nb_contacts"
   FROM "crm"."companies_summary";


ALTER VIEW "public"."companies_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."configuration" WITH ("security_invoker"='on') AS
 SELECT "id",
    "config"
   FROM "crm"."configuration";


ALTER VIEW "public"."configuration" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."contact_notes" WITH ("security_invoker"='on') AS
 SELECT "id",
    "contact_id",
    "text",
    "date",
    "sales_id",
    "status",
    "attachments"
   FROM "crm"."contact_notes";


ALTER VIEW "public"."contact_notes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."contacts" WITH ("security_invoker"='on') AS
 SELECT "id",
    "first_name",
    "last_name",
    "gender",
    "title",
    "background",
    "avatar",
    "first_seen",
    "last_seen",
    "has_newsletter",
    "status",
    "tags",
    "company_id",
    "sales_id",
    "linkedin_url",
    "email_jsonb",
    "phone_jsonb"
   FROM "crm"."contacts";


ALTER VIEW "public"."contacts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."contacts_summary" WITH ("security_invoker"='on') AS
 SELECT "id",
    "first_name",
    "last_name",
    "gender",
    "title",
    "background",
    "avatar",
    "first_seen",
    "last_seen",
    "has_newsletter",
    "status",
    "tags",
    "company_id",
    "sales_id",
    "linkedin_url",
    "email_jsonb",
    "phone_jsonb",
    "company_name",
    "nb_tasks"
   FROM "crm"."contacts_summary";


ALTER VIEW "public"."contacts_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_costs" (
    "id" bigint NOT NULL,
    "date" "date" NOT NULL,
    "openai_tokens" bigint DEFAULT 0,
    "openai_cost" numeric(10,4) DEFAULT 0,
    "anthropic_tokens" bigint DEFAULT 0,
    "anthropic_cost" numeric(10,4) DEFAULT 0,
    "moonshot_tokens" bigint DEFAULT 0,
    "moonshot_cost" numeric(10,4) DEFAULT 0,
    "total_cost" numeric(10,4) DEFAULT 0,
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_costs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."daily_costs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."daily_costs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."daily_costs_id_seq" OWNED BY "public"."daily_costs"."id";



CREATE OR REPLACE VIEW "public"."deal_notes" WITH ("security_invoker"='on') AS
 SELECT "id",
    "deal_id",
    "type",
    "text",
    "date",
    "sales_id",
    "attachments"
   FROM "crm"."deal_notes";


ALTER VIEW "public"."deal_notes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."deals" WITH ("security_invoker"='on') AS
 SELECT "id",
    "name",
    "company_id",
    "contact_ids",
    "category",
    "stage",
    "description",
    "amount",
    "created_at",
    "updated_at",
    "archived_at",
    "expected_closing_date",
    "sales_id",
    "index"
   FROM "crm"."deals";


ALTER VIEW "public"."deals" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."favicons_excluded_domains" WITH ("security_invoker"='on') AS
 SELECT "id",
    "domain"
   FROM "crm"."favicons_excluded_domains";


ALTER VIEW "public"."favicons_excluded_domains" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."init_state" WITH ("security_invoker"='off') AS
 SELECT "count"("id") AS "is_initialized"
   FROM "crm"."sales"
 LIMIT 1;


ALTER VIEW "public"."init_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" integer NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "crew_needed" integer DEFAULT 1 NOT NULL,
    "priority" "text",
    "section" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "jobs_priority_check" CHECK (("priority" = ANY (ARRAY['Low'::"text", 'Normal'::"text", 'High'::"text", 'Urgent'::"text"]))),
    CONSTRAINT "jobs_section_check" CHECK (("section" = ANY (ARRAY['First Jobs'::"text", 'Second Jobs'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."jobs" IS 'Job templates/library for golf course maintenance tasks';



CREATE SEQUENCE IF NOT EXISTS "public"."jobs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."jobs_id_seq" OWNED BY "public"."jobs"."id";



CREATE OR REPLACE VIEW "public"."sales" WITH ("security_invoker"='on') AS
 SELECT "id",
    "first_name",
    "last_name",
    "email",
    "administrator",
    "user_id",
    "avatar",
    "disabled"
   FROM "crm"."sales";


ALTER VIEW "public"."sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" integer NOT NULL,
    "role" "text" NOT NULL,
    "name" "text" NOT NULL,
    "telephone" "text",
    "telegram_id" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff" IS 'Staff members for golf course operations';



COMMENT ON COLUMN "public"."staff"."telegram_id" IS 'Telegram username or ID for messaging';



CREATE SEQUENCE IF NOT EXISTS "public"."staff_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staff_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."staff_id_seq" OWNED BY "public"."staff"."id";



CREATE OR REPLACE VIEW "public"."tags" WITH ("security_invoker"='on') AS
 SELECT "id",
    "name",
    "color"
   FROM "crm"."tags";


ALTER VIEW "public"."tags" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."tasks" WITH ("security_invoker"='on') AS
 SELECT "id",
    "contact_id",
    "type",
    "text",
    "due_date",
    "done_date",
    "sales_id"
   FROM "crm"."tasks";


ALTER VIEW "public"."tasks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."winnow_performance" AS
 SELECT
        CASE
            WHEN ("winnow_score" >= 55) THEN 'auto-identified (>=55)'::"text"
            WHEN ("winnow_score" >= 25) THEN 'middle-band (25-54)'::"text"
            ELSE 'skip/closed (<25)'::"text"
        END AS "score_band",
    "decision",
    "haiku_decision",
    "count"(*) AS "total_decisions",
    "count"("outcome_actual") AS "with_outcome",
    "count"(
        CASE
            WHEN ("outcome_actual" = ANY (ARRAY['CONTACTED'::"text", 'REPLIED'::"text", 'CLOSED-WON'::"text"])) THEN 1
            ELSE NULL::integer
        END) AS "converted",
    "count"(
        CASE
            WHEN "override_by_human" THEN 1
            ELSE NULL::integer
        END) AS "human_overrides",
    "round"(((100.0 * ("count"(
        CASE
            WHEN ("outcome_actual" = ANY (ARRAY['CONTACTED'::"text", 'REPLIED'::"text", 'CLOSED-WON'::"text"])) THEN 1
            ELSE NULL::integer
        END))::numeric) / (NULLIF("count"("outcome_actual"), 0))::numeric), 1) AS "conversion_rate_pct"
   FROM "wpa"."wpa_winnow_decisions"
  GROUP BY
        CASE
            WHEN ("winnow_score" >= 55) THEN 'auto-identified (>=55)'::"text"
            WHEN ("winnow_score" >= 25) THEN 'middle-band (25-54)'::"text"
            ELSE 'skip/closed (<25)'::"text"
        END, "decision", "haiku_decision"
  ORDER BY
        CASE
            WHEN ("winnow_score" >= 55) THEN 'auto-identified (>=55)'::"text"
            WHEN ("winnow_score" >= 25) THEN 'middle-band (25-54)'::"text"
            ELSE 'skip/closed (<25)'::"text"
        END, "decision";


ALTER VIEW "public"."winnow_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wpa_clients" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "service_tier" "text" DEFAULT 'Lazy Ranking'::"text" NOT NULL,
    "monthly_revenue" numeric(10,2) DEFAULT 0,
    "current_phase" "text" DEFAULT ''::"text",
    "next_action" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "start_date" "date",
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "address" "text" DEFAULT ''::"text",
    "phone" "text" DEFAULT ''::"text",
    "website_url" "text" DEFAULT ''::"text",
    "folder_path" "text",
    CONSTRAINT "wpa_clients_service_tier_check" CHECK (("service_tier" = ANY (ARRAY['Lazy Ranking'::"text", 'Core 30'::"text", 'Geographic Expansion'::"text"]))),
    CONSTRAINT "wpa_clients_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'churned'::"text"])))
);


ALTER TABLE "public"."wpa_clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."wpa_clients"."folder_path" IS 'File server path relative to /files/ root, e.g. WhitePineAgency/Clients/Active/Dog-Zen';



CREATE SEQUENCE IF NOT EXISTS "public"."wpa_clients_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wpa_clients_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wpa_clients_id_seq" OWNED BY "public"."wpa_clients"."id";



CREATE TABLE IF NOT EXISTS "public"."wpa_contact_notes" (
    "id" bigint NOT NULL,
    "contact_id" bigint NOT NULL,
    "type" "text" DEFAULT 'note'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wpa_contact_notes_type_check" CHECK (("type" = ANY (ARRAY['call'::"text", 'email'::"text", 'meeting'::"text", 'text'::"text", 'note'::"text"])))
);


ALTER TABLE "public"."wpa_contact_notes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."wpa_contact_notes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wpa_contact_notes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wpa_contact_notes_id_seq" OWNED BY "public"."wpa_contact_notes"."id";



CREATE TABLE IF NOT EXISTS "public"."wpa_contacts" (
    "id" bigint NOT NULL,
    "business_id" "text",
    "client_id" bigint,
    "name" "text" NOT NULL,
    "role" "text" DEFAULT ''::"text",
    "phone" "text" DEFAULT ''::"text",
    "email" "text" DEFAULT ''::"text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."wpa_contacts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."wpa_contacts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wpa_contacts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wpa_contacts_id_seq" OWNED BY "public"."wpa_contacts"."id";



CREATE TABLE IF NOT EXISTS "public"."wpa_projects" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "progress_pct" integer DEFAULT 0,
    "next_milestone" "text" DEFAULT ''::"text",
    "client_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wpa_projects_progress_pct_check" CHECK ((("progress_pct" >= 0) AND ("progress_pct" <= 100))),
    CONSTRAINT "wpa_projects_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'on_hold'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."wpa_projects" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."wpa_projects_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wpa_projects_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wpa_projects_id_seq" OWNED BY "public"."wpa_projects"."id";



CREATE TABLE IF NOT EXISTS "public"."wpa_tasks" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "category" "text" DEFAULT 'WPA Own'::"text" NOT NULL,
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "client_id" bigint,
    "project_id" bigint,
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wpa_tasks_category_check" CHECK (("category" = ANY (ARRAY['Client Work'::"text", 'WPA Own'::"text", 'Infrastructure'::"text", 'Backlog'::"text"]))),
    CONSTRAINT "wpa_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "wpa_tasks_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'in_progress'::"text", 'blocked'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."wpa_tasks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."wpa_tasks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."wpa_tasks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."wpa_tasks_id_seq" OWNED BY "public"."wpa_tasks"."id";



ALTER TABLE ONLY "public"."audits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."daily_costs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."daily_costs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."staff" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."staff_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wpa_clients" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wpa_clients_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wpa_contact_notes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wpa_contact_notes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wpa_contacts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wpa_contacts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wpa_projects" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wpa_projects_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."wpa_tasks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."wpa_tasks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audits"
    ADD CONSTRAINT "audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_costs"
    ADD CONSTRAINT "daily_costs_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."daily_costs"
    ADD CONSTRAINT "daily_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wpa_clients"
    ADD CONSTRAINT "wpa_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wpa_contact_notes"
    ADD CONSTRAINT "wpa_contact_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wpa_contacts"
    ADD CONSTRAINT "wpa_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wpa_projects"
    ADD CONSTRAINT "wpa_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wpa_tasks"
    ADD CONSTRAINT "wpa_tasks_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audits_business_id" ON "public"."audits" USING "btree" ("business_id");



CREATE INDEX "idx_audits_score" ON "public"."audits" USING "btree" ("score");



CREATE INDEX "idx_businesses_contact_status" ON "public"."businesses" USING "btree" ("contact_status");



CREATE INDEX "idx_businesses_discovered_at" ON "public"."businesses" USING "btree" ("discovered_at" DESC);



CREATE INDEX "idx_businesses_search_query" ON "public"."businesses" USING "btree" ("search_query");



CREATE INDEX "idx_wpa_contact_notes_contact_id" ON "public"."wpa_contact_notes" USING "btree" ("contact_id");



CREATE INDEX "idx_wpa_contacts_business_id" ON "public"."wpa_contacts" USING "btree" ("business_id");



CREATE INDEX "idx_wpa_contacts_client_id" ON "public"."wpa_contacts" USING "btree" ("client_id");



ALTER TABLE ONLY "public"."audits"
    ADD CONSTRAINT "audits_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wpa_contact_notes"
    ADD CONSTRAINT "wpa_contact_notes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."wpa_contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wpa_contacts"
    ADD CONSTRAINT "wpa_contacts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wpa_contacts"
    ADD CONSTRAINT "wpa_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."wpa_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wpa_projects"
    ADD CONSTRAINT "wpa_projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."wpa_clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wpa_tasks"
    ADD CONSTRAINT "wpa_tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."wpa_clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wpa_tasks"
    ADD CONSTRAINT "wpa_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."wpa_projects"("id") ON DELETE SET NULL;



CREATE POLICY "anon_full_access" ON "public"."audits" USING (true) WITH CHECK (true);



CREATE POLICY "anon_full_access" ON "public"."businesses" USING (true) WITH CHECK (true);



CREATE POLICY "anon_full_access" ON "public"."daily_costs" USING (true) WITH CHECK (true);



CREATE POLICY "anon_full_access" ON "public"."jobs" USING (true) WITH CHECK (true);



CREATE POLICY "anon_full_access" ON "public"."staff" USING (true) WITH CHECK (true);



CREATE POLICY "anon_full_access" ON "public"."wpa_clients" USING (true) WITH CHECK (true);



CREATE POLICY "anon_full_access" ON "public"."wpa_contact_notes" USING (true) WITH CHECK (true);



CREATE POLICY "anon_full_access" ON "public"."wpa_contacts" USING (true) WITH CHECK (true);



CREATE POLICY "anon_full_access" ON "public"."wpa_projects" USING (true) WITH CHECK (true);



CREATE POLICY "anon_full_access" ON "public"."wpa_tasks" USING (true) WITH CHECK (true);



ALTER TABLE "public"."audits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_full_access" ON "public"."audits" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated_full_access" ON "public"."businesses" USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_costs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wpa_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wpa_contact_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wpa_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wpa_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wpa_tasks" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_sql"("query_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."execute_sql"("query_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_sql"("query_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_avatar_for_email"("email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_avatar_for_email"("email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_avatar_for_email"("email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_domain_favicon"("domain_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_domain_favicon"("domain_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_domain_favicon"("domain_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_id_by_email"("email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_company_saved"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_company_saved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_company_saved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_contact_note_created_or_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_contact_note_created_or_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_contact_note_created_or_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_contact_saved"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_contact_saved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_contact_saved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_contacts"("loser_id" bigint, "winner_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."merge_contacts"("loser_id" bigint, "winner_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_contacts"("loser_id" bigint, "winner_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_sales_id_default"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_sales_id_default"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_sales_id_default"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_winnow_outcome_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_winnow_outcome_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_winnow_outcome_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_activity"() TO "service_role";



GRANT ALL ON TABLE "public"."audits" TO "anon";
GRANT ALL ON TABLE "public"."audits" TO "authenticated";
GRANT ALL ON TABLE "public"."audits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."businesses_with_crm_status" TO "anon";
GRANT ALL ON TABLE "public"."businesses_with_crm_status" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses_with_crm_status" TO "service_role";



GRANT ALL ON TABLE "public"."businesses_with_score" TO "anon";
GRANT ALL ON TABLE "public"."businesses_with_score" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses_with_score" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."companies_summary" TO "anon";
GRANT ALL ON TABLE "public"."companies_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."companies_summary" TO "service_role";



GRANT ALL ON TABLE "public"."configuration" TO "anon";
GRANT ALL ON TABLE "public"."configuration" TO "authenticated";
GRANT ALL ON TABLE "public"."configuration" TO "service_role";



GRANT ALL ON TABLE "public"."contact_notes" TO "anon";
GRANT ALL ON TABLE "public"."contact_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_notes" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."contacts_summary" TO "anon";
GRANT ALL ON TABLE "public"."contacts_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts_summary" TO "service_role";



GRANT ALL ON TABLE "public"."daily_costs" TO "anon";
GRANT ALL ON TABLE "public"."daily_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_costs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_costs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_costs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_costs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."deal_notes" TO "anon";
GRANT ALL ON TABLE "public"."deal_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."deal_notes" TO "service_role";



GRANT ALL ON TABLE "public"."deals" TO "anon";
GRANT ALL ON TABLE "public"."deals" TO "authenticated";
GRANT ALL ON TABLE "public"."deals" TO "service_role";



GRANT ALL ON TABLE "public"."favicons_excluded_domains" TO "anon";
GRANT ALL ON TABLE "public"."favicons_excluded_domains" TO "authenticated";
GRANT ALL ON TABLE "public"."favicons_excluded_domains" TO "service_role";



GRANT ALL ON TABLE "public"."init_state" TO "anon";
GRANT ALL ON TABLE "public"."init_state" TO "authenticated";
GRANT ALL ON TABLE "public"."init_state" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."winnow_performance" TO "anon";
GRANT ALL ON TABLE "public"."winnow_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."winnow_performance" TO "service_role";



GRANT ALL ON TABLE "public"."wpa_clients" TO "anon";
GRANT ALL ON TABLE "public"."wpa_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."wpa_clients" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wpa_clients_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wpa_clients_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wpa_clients_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wpa_contact_notes" TO "anon";
GRANT ALL ON TABLE "public"."wpa_contact_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."wpa_contact_notes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wpa_contact_notes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wpa_contact_notes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wpa_contact_notes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wpa_contacts" TO "anon";
GRANT ALL ON TABLE "public"."wpa_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."wpa_contacts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wpa_contacts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wpa_contacts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wpa_contacts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wpa_projects" TO "anon";
GRANT ALL ON TABLE "public"."wpa_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."wpa_projects" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wpa_projects_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wpa_projects_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wpa_projects_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wpa_tasks" TO "anon";
GRANT ALL ON TABLE "public"."wpa_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."wpa_tasks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wpa_tasks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wpa_tasks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wpa_tasks_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







-- ===== public schema DATA =====
SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: businesses; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: audits; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: daily_costs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."daily_costs" ("id", "date", "openai_tokens", "openai_cost", "anthropic_tokens", "anthropic_cost", "moonshot_tokens", "moonshot_cost", "total_cost", "raw_data", "created_at") VALUES
	(1, '2026-02-28', 150000, 0.4500, 500000, 2.5000, 0, 0.0000, 2.9500, NULL, '2026-03-14 16:15:45.688102+00'),
	(2, '2026-03-01', 120000, 0.3600, 450000, 2.2500, 50000, 0.1000, 2.7100, NULL, '2026-03-14 16:15:45.688102+00'),
	(3, '2026-03-02', 180000, 0.5400, 600000, 3.0000, 30000, 0.0600, 3.6000, NULL, '2026-03-14 16:15:45.688102+00');


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."jobs" ("id", "title", "description", "crew_needed", "priority", "section", "created_at", "updated_at") VALUES
	(1, 'Tree Work', NULL, 3, NULL, NULL, '2026-03-01 15:22:43.300343+00', '2026-03-01 15:22:43.300343+00'),
	(2, 'Tree Work', NULL, 3, NULL, NULL, '2026-03-13 01:50:50.51244+00', '2026-03-13 01:50:50.51244+00'),
	(3, 'Tree Work', NULL, 3, NULL, NULL, '2026-03-22 02:37:18.095605+00', '2026-03-22 02:37:18.095605+00');


--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."staff" ("id", "role", "name", "telephone", "telegram_id", "notes", "created_at", "updated_at") VALUES
	(1, 'Superintendent', 'Darryl', '208-949-9264', NULL, NULL, '2026-03-01 15:22:43.300343+00', '2026-03-01 15:22:43.300343+00'),
	(2, 'Superintendent', 'Darryl', '208-949-9264', NULL, NULL, '2026-03-13 01:50:50.51244+00', '2026-03-13 01:50:50.51244+00'),
	(3, 'Superintendent', 'Darryl', '208-949-9264', NULL, NULL, '2026-03-22 02:37:18.095605+00', '2026-03-22 02:37:18.095605+00');


--
-- Data for Name: wpa_clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wpa_clients" ("id", "name", "service_tier", "monthly_revenue", "current_phase", "next_action", "status", "start_date", "notes", "created_at", "updated_at", "address", "phone", "website_url", "folder_path") VALUES
	(2, 'Harveys on the Green', 'Core 30', 0.00, 'Portfolio Build', 'Complete website build', 'active', '2026-02-20', 'Restaurant at Banbury Golf Course. Website + GBP optimization.', '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00', '', '', '', 'WhitePineAgency/Clients/Active/Harveys-on-the-Green'),
	(1, 'Dog-Zen', 'Lazy Ranking', 65.00, 'GBP Optimization', 'Citation building week 2', 'active', '2026-02-15', 'Dog grooming salon in Eagle. GBP recovery after suspension.', '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00', '', '', '', 'WhitePineAgency/Clients/Active/Dog-Zen');


--
-- Data for Name: wpa_contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: wpa_contact_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: wpa_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wpa_projects" ("id", "name", "description", "status", "progress_pct", "next_milestone", "client_id", "created_at", "updated_at") VALUES
	(1, 'WPA Command Center', 'Internal dashboard replacing Atomic CRM', 'active', 50, 'MVP deployment', NULL, '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00'),
	(2, 'WPA Website', 'White Pine Agency marketing site', 'completed', 100, '', NULL, '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00'),
	(3, 'Dog-Zen GBP Optimization', 'Full GBP optimization for Dog-Zen', 'active', 30, 'Week 2 citations complete', 1, '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00'),
	(4, 'Harveys Website Build', 'Core 30 site build for Harveys', 'active', 10, 'Design review', 2, '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00');


--
-- Data for Name: wpa_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."wpa_tasks" ("id", "title", "description", "category", "status", "priority", "client_id", "project_id", "due_date", "completed_at", "created_at", "updated_at") VALUES
	(1, 'Complete citation submissions', 'Submit to Apple Maps, Bing Places, BBB', 'Client Work', 'in_progress', 'high', 1, NULL, '2026-03-07', NULL, '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00'),
	(2, 'Build Harveys website', 'Core 30 multi-page site with service-city pages', 'Client Work', 'todo', 'high', 2, NULL, '2026-03-15', NULL, '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00'),
	(3, 'Deploy Command Center', 'Build and deploy to dashboard.whitepineagency.com', 'Infrastructure', 'in_progress', 'urgent', NULL, NULL, '2026-03-02', NULL, '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00'),
	(4, 'Set up cost tracking cron', 'Configure nightly sync-costs.sh on beefy', 'Infrastructure', 'todo', 'medium', NULL, NULL, '2026-03-05', NULL, '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00'),
	(5, 'Canvass Eagle businesses', 'Walk Main Street with iPad showing lead sites', 'WPA Own', 'todo', 'medium', NULL, NULL, '2026-03-08', NULL, '2026-03-14 16:15:45.688102+00', '2026-03-14 16:15:45.688102+00');


--
-- Name: audits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."audits_id_seq"', 1, false);


--
-- Name: daily_costs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."daily_costs_id_seq"', 3, true);


--
-- Name: jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."jobs_id_seq"', 3, true);


--
-- Name: staff_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."staff_id_seq"', 3, true);


--
-- Name: wpa_clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."wpa_clients_id_seq"', 2, true);


--
-- Name: wpa_contact_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."wpa_contact_notes_id_seq"', 8, true);


--
-- Name: wpa_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."wpa_contacts_id_seq"', 1, false);


--
-- Name: wpa_projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."wpa_projects_id_seq"', 4, true);


--
-- Name: wpa_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."wpa_tasks_id_seq"', 5, true);


--
-- PostgreSQL database dump complete
--

RESET ALL;

-- ===== crm schema =====


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "crm";


ALTER SCHEMA "crm" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "crm"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  sales_count int;
BEGIN
  SELECT count(id) INTO sales_count
  FROM crm.sales;

  INSERT INTO crm.sales (first_name, last_name, email, user_id, administrator)
  VALUES (
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email,
    NEW.id,
    CASE WHEN sales_count > 0 THEN FALSE ELSE TRUE END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "crm"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "crm"."handle_update_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE crm.sales
  SET
    first_name = COALESCE(
      NEW.raw_user_meta_data ->> 'first_name',
      NEW.raw_user_meta_data -> 'custom_claims' ->> 'first_name',
      first_name
    ),
    last_name = COALESCE(
      NEW.raw_user_meta_data ->> 'last_name',
      NEW.raw_user_meta_data -> 'custom_claims' ->> 'last_name',
      last_name
    ),
    email = COALESCE(NEW.email, email)
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "crm"."handle_update_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "crm"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM crm.sales WHERE user_id = auth.uid() AND administrator = TRUE
  );
$$;


ALTER FUNCTION "crm"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "crm"."set_sales_id_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.sales_id IS NULL THEN
    SELECT id INTO NEW.sales_id FROM crm.sales WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "crm"."set_sales_id_default"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "crm"."companies" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "sector" "text",
    "size" smallint,
    "linkedin_url" "text",
    "website" "text",
    "phone_number" "text",
    "address" "text",
    "zipcode" "text",
    "city" "text",
    "state_abbr" "text",
    "sales_id" bigint,
    "context_links" json,
    "country" "text",
    "description" "text",
    "revenue" "text",
    "tax_identifier" "text",
    "logo" "jsonb",
    "business_id" "text"
);


ALTER TABLE "crm"."companies" OWNER TO "postgres";


ALTER TABLE "crm"."companies" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "crm"."companies_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "crm"."companies_summary" AS
SELECT
    NULL::bigint AS "id",
    NULL::timestamp with time zone AS "created_at",
    NULL::"text" AS "name",
    NULL::"text" AS "sector",
    NULL::smallint AS "size",
    NULL::"text" AS "linkedin_url",
    NULL::"text" AS "website",
    NULL::"text" AS "phone_number",
    NULL::"text" AS "address",
    NULL::"text" AS "zipcode",
    NULL::"text" AS "city",
    NULL::"text" AS "state_abbr",
    NULL::bigint AS "sales_id",
    NULL::json AS "context_links",
    NULL::"text" AS "country",
    NULL::"text" AS "description",
    NULL::"text" AS "revenue",
    NULL::"text" AS "tax_identifier",
    NULL::"jsonb" AS "logo",
    NULL::bigint AS "nb_deals",
    NULL::bigint AS "nb_contacts";


ALTER VIEW "crm"."companies_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."configuration" (
    "id" integer DEFAULT 1 NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "configuration_singleton" CHECK (("id" = 1))
);


ALTER TABLE "crm"."configuration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."contact_notes" (
    "id" bigint NOT NULL,
    "contact_id" bigint NOT NULL,
    "text" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "sales_id" bigint,
    "status" "text",
    "attachments" "jsonb"[]
);


ALTER TABLE "crm"."contact_notes" OWNER TO "postgres";


ALTER TABLE "crm"."contact_notes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "crm"."contactNotes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "crm"."contacts" (
    "id" bigint NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "gender" "text",
    "title" "text",
    "background" "text",
    "avatar" "jsonb",
    "first_seen" timestamp with time zone,
    "last_seen" timestamp with time zone,
    "has_newsletter" boolean,
    "status" "text",
    "tags" bigint[],
    "company_id" bigint,
    "sales_id" bigint,
    "linkedin_url" "text",
    "email_jsonb" "jsonb",
    "phone_jsonb" "jsonb"
);


ALTER TABLE "crm"."contacts" OWNER TO "postgres";


ALTER TABLE "crm"."contacts" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "crm"."contacts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "crm"."contacts_summary" AS
SELECT
    NULL::bigint AS "id",
    NULL::"text" AS "first_name",
    NULL::"text" AS "last_name",
    NULL::"text" AS "gender",
    NULL::"text" AS "title",
    NULL::"text" AS "background",
    NULL::"jsonb" AS "avatar",
    NULL::timestamp with time zone AS "first_seen",
    NULL::timestamp with time zone AS "last_seen",
    NULL::boolean AS "has_newsletter",
    NULL::"text" AS "status",
    NULL::bigint[] AS "tags",
    NULL::bigint AS "company_id",
    NULL::bigint AS "sales_id",
    NULL::"text" AS "linkedin_url",
    NULL::"jsonb" AS "email_jsonb",
    NULL::"jsonb" AS "phone_jsonb",
    NULL::"text" AS "company_name",
    NULL::bigint AS "nb_tasks";


ALTER VIEW "crm"."contacts_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."deal_notes" (
    "id" bigint NOT NULL,
    "deal_id" bigint NOT NULL,
    "type" "text",
    "text" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "sales_id" bigint,
    "attachments" "jsonb"[]
);


ALTER TABLE "crm"."deal_notes" OWNER TO "postgres";


ALTER TABLE "crm"."deal_notes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "crm"."dealNotes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "crm"."deals" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "company_id" bigint,
    "contact_ids" bigint[],
    "category" "text",
    "stage" "text" NOT NULL,
    "description" "text",
    "amount" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "expected_closing_date" timestamp with time zone,
    "sales_id" bigint,
    "index" smallint
);


ALTER TABLE "crm"."deals" OWNER TO "postgres";


ALTER TABLE "crm"."deals" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "crm"."deals_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "crm"."favicons_excluded_domains" (
    "id" bigint NOT NULL,
    "domain" "text" NOT NULL
);


ALTER TABLE "crm"."favicons_excluded_domains" OWNER TO "postgres";


ALTER TABLE "crm"."favicons_excluded_domains" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "crm"."favicons_excluded_domains_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "crm"."sales" (
    "id" bigint NOT NULL,
    "first_name" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "last_name" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "email" "text" NOT NULL,
    "administrator" boolean NOT NULL,
    "user_id" "uuid" NOT NULL,
    "avatar" "jsonb",
    "disabled" boolean DEFAULT false NOT NULL
);


ALTER TABLE "crm"."sales" OWNER TO "postgres";


CREATE OR REPLACE VIEW "crm"."init_state" WITH ("security_invoker"='off') AS
 SELECT "count"("id") AS "is_initialized"
   FROM "crm"."sales"
 LIMIT 1;


ALTER VIEW "crm"."init_state" OWNER TO "postgres";


ALTER TABLE "crm"."sales" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "crm"."sales_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "crm"."tags" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" NOT NULL
);


ALTER TABLE "crm"."tags" OWNER TO "postgres";


ALTER TABLE "crm"."tags" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "crm"."tags_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "crm"."tasks" (
    "id" bigint NOT NULL,
    "contact_id" bigint NOT NULL,
    "type" "text",
    "text" "text",
    "due_date" timestamp with time zone,
    "done_date" timestamp with time zone,
    "sales_id" bigint
);


ALTER TABLE "crm"."tasks" OWNER TO "postgres";


ALTER TABLE "crm"."tasks" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "crm"."tasks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "crm"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."configuration"
    ADD CONSTRAINT "configuration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."contact_notes"
    ADD CONSTRAINT "contactNotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."deal_notes"
    ADD CONSTRAINT "dealNotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."deals"
    ADD CONSTRAINT "deals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."favicons_excluded_domains"
    ADD CONSTRAINT "favicons_excluded_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



CREATE INDEX "companies_business_id_idx" ON "crm"."companies" USING "btree" ("business_id");



CREATE UNIQUE INDEX "uq__sales__user_id" ON "crm"."sales" USING "btree" ("user_id");



CREATE OR REPLACE VIEW "crm"."companies_summary" WITH ("security_invoker"='on') AS
 SELECT "c"."id",
    "c"."created_at",
    "c"."name",
    "c"."sector",
    "c"."size",
    "c"."linkedin_url",
    "c"."website",
    "c"."phone_number",
    "c"."address",
    "c"."zipcode",
    "c"."city",
    "c"."state_abbr",
    "c"."sales_id",
    "c"."context_links",
    "c"."country",
    "c"."description",
    "c"."revenue",
    "c"."tax_identifier",
    "c"."logo",
    "count"(DISTINCT "d"."id") AS "nb_deals",
    "count"(DISTINCT "co"."id") AS "nb_contacts"
   FROM (("crm"."companies" "c"
     LEFT JOIN "crm"."deals" "d" ON (("c"."id" = "d"."company_id")))
     LEFT JOIN "crm"."contacts" "co" ON (("c"."id" = "co"."company_id")))
  GROUP BY "c"."id";



CREATE OR REPLACE VIEW "crm"."contacts_summary" WITH ("security_invoker"='on') AS
 SELECT "co"."id",
    "co"."first_name",
    "co"."last_name",
    "co"."gender",
    "co"."title",
    "co"."background",
    "co"."avatar",
    "co"."first_seen",
    "co"."last_seen",
    "co"."has_newsletter",
    "co"."status",
    "co"."tags",
    "co"."company_id",
    "co"."sales_id",
    "co"."linkedin_url",
    "co"."email_jsonb",
    "co"."phone_jsonb",
    "c"."name" AS "company_name",
    "count"(DISTINCT "t"."id") AS "nb_tasks"
   FROM (("crm"."contacts" "co"
     LEFT JOIN "crm"."tasks" "t" ON (("co"."id" = "t"."contact_id")))
     LEFT JOIN "crm"."companies" "c" ON (("co"."company_id" = "c"."id")))
  GROUP BY "co"."id", "c"."name";



CREATE OR REPLACE TRIGGER "company_saved" BEFORE INSERT OR UPDATE ON "crm"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."handle_company_saved"();



CREATE OR REPLACE TRIGGER "contact_saved" BEFORE INSERT OR UPDATE ON "crm"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_contact_saved"();



CREATE OR REPLACE TRIGGER "on_public_contact_notes_created_or_updated" AFTER INSERT ON "crm"."contact_notes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_contact_note_created_or_updated"();



CREATE OR REPLACE TRIGGER "set_company_sales_id_trigger" BEFORE INSERT ON "crm"."companies" FOR EACH ROW EXECUTE FUNCTION "crm"."set_sales_id_default"();



CREATE OR REPLACE TRIGGER "set_contact_notes_sales_id_trigger" BEFORE INSERT ON "crm"."contact_notes" FOR EACH ROW EXECUTE FUNCTION "crm"."set_sales_id_default"();



CREATE OR REPLACE TRIGGER "set_contact_sales_id_trigger" BEFORE INSERT ON "crm"."contacts" FOR EACH ROW EXECUTE FUNCTION "crm"."set_sales_id_default"();



CREATE OR REPLACE TRIGGER "set_deal_notes_sales_id_trigger" BEFORE INSERT ON "crm"."deal_notes" FOR EACH ROW EXECUTE FUNCTION "crm"."set_sales_id_default"();



CREATE OR REPLACE TRIGGER "set_deal_sales_id_trigger" BEFORE INSERT ON "crm"."deals" FOR EACH ROW EXECUTE FUNCTION "crm"."set_sales_id_default"();



CREATE OR REPLACE TRIGGER "set_task_sales_id_trigger" BEFORE INSERT ON "crm"."tasks" FOR EACH ROW EXECUTE FUNCTION "crm"."set_sales_id_default"();



ALTER TABLE ONLY "crm"."companies"
    ADD CONSTRAINT "companies_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "wpa"."wpa_businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "crm"."companies"
    ADD CONSTRAINT "companies_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "crm"."sales"("id");



ALTER TABLE ONLY "crm"."contact_notes"
    ADD CONSTRAINT "contactNotes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "crm"."contact_notes"
    ADD CONSTRAINT "contactNotes_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "crm"."sales"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "crm"."contacts"
    ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "crm"."contacts"
    ADD CONSTRAINT "contacts_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "crm"."sales"("id");



ALTER TABLE ONLY "crm"."deal_notes"
    ADD CONSTRAINT "dealNotes_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "crm"."deals"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "crm"."deal_notes"
    ADD CONSTRAINT "dealNotes_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "crm"."sales"("id");



ALTER TABLE ONLY "crm"."deals"
    ADD CONSTRAINT "deals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "crm"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "crm"."deals"
    ADD CONSTRAINT "deals_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "crm"."sales"("id");



ALTER TABLE ONLY "crm"."sales"
    ADD CONSTRAINT "sales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "crm"."tasks"
    ADD CONSTRAINT "tasks_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "crm"."contacts"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Company Delete Policy" ON "crm"."companies" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Contact Delete Policy" ON "crm"."contacts" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Contact Notes Delete Policy" ON "crm"."contact_notes" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Contact Notes Update policy" ON "crm"."contact_notes" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Deal Notes Delete Policy" ON "crm"."deal_notes" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Deal Notes Update Policy" ON "crm"."deal_notes" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Deals Delete Policy" ON "crm"."deals" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable access for authenticated users only" ON "crm"."favicons_excluded_domains" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable delete for authenticated users only" ON "crm"."tags" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable insert for admins" ON "crm"."configuration" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Enable insert for authenticated users only" ON "crm"."companies" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "crm"."contact_notes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "crm"."contacts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "crm"."deal_notes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "crm"."deals" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "crm"."tags" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "crm"."tasks" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for authenticated users" ON "crm"."companies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "crm"."contact_notes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "crm"."contacts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "crm"."deal_notes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "crm"."deals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "crm"."sales" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "crm"."tags" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "crm"."tasks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read for authenticated" ON "crm"."configuration" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable update for admins" ON "crm"."configuration" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Enable update for authenticated users only" ON "crm"."companies" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "crm"."contacts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "crm"."deals" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "crm"."tags" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Task Delete Policy" ON "crm"."tasks" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Task Update Policy" ON "crm"."tasks" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "crm"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."configuration" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."contact_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."deal_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."deals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."favicons_excluded_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."tasks" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "crm" TO "anon";
GRANT USAGE ON SCHEMA "crm" TO "authenticated";
GRANT USAGE ON SCHEMA "crm" TO "service_role";



GRANT ALL ON FUNCTION "crm"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "crm"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "crm"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "crm"."handle_update_user"() TO "anon";
GRANT ALL ON FUNCTION "crm"."handle_update_user"() TO "authenticated";
GRANT ALL ON FUNCTION "crm"."handle_update_user"() TO "service_role";



GRANT ALL ON FUNCTION "crm"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "crm"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "crm"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "crm"."set_sales_id_default"() TO "anon";
GRANT ALL ON FUNCTION "crm"."set_sales_id_default"() TO "authenticated";
GRANT ALL ON FUNCTION "crm"."set_sales_id_default"() TO "service_role";



GRANT ALL ON TABLE "crm"."companies" TO "anon";
GRANT ALL ON TABLE "crm"."companies" TO "authenticated";
GRANT ALL ON TABLE "crm"."companies" TO "service_role";



GRANT ALL ON SEQUENCE "crm"."companies_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "crm"."companies_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "crm"."companies_id_seq" TO "service_role";



GRANT ALL ON TABLE "crm"."companies_summary" TO "anon";
GRANT ALL ON TABLE "crm"."companies_summary" TO "authenticated";
GRANT ALL ON TABLE "crm"."companies_summary" TO "service_role";



GRANT ALL ON TABLE "crm"."configuration" TO "anon";
GRANT ALL ON TABLE "crm"."configuration" TO "authenticated";
GRANT ALL ON TABLE "crm"."configuration" TO "service_role";



GRANT ALL ON TABLE "crm"."contact_notes" TO "anon";
GRANT ALL ON TABLE "crm"."contact_notes" TO "authenticated";
GRANT ALL ON TABLE "crm"."contact_notes" TO "service_role";



GRANT ALL ON SEQUENCE "crm"."contactNotes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "crm"."contactNotes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "crm"."contactNotes_id_seq" TO "service_role";



GRANT ALL ON TABLE "crm"."contacts" TO "anon";
GRANT ALL ON TABLE "crm"."contacts" TO "authenticated";
GRANT ALL ON TABLE "crm"."contacts" TO "service_role";



GRANT ALL ON SEQUENCE "crm"."contacts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "crm"."contacts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "crm"."contacts_id_seq" TO "service_role";



GRANT ALL ON TABLE "crm"."contacts_summary" TO "anon";
GRANT ALL ON TABLE "crm"."contacts_summary" TO "authenticated";
GRANT ALL ON TABLE "crm"."contacts_summary" TO "service_role";



GRANT ALL ON TABLE "crm"."deal_notes" TO "anon";
GRANT ALL ON TABLE "crm"."deal_notes" TO "authenticated";
GRANT ALL ON TABLE "crm"."deal_notes" TO "service_role";



GRANT ALL ON SEQUENCE "crm"."dealNotes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "crm"."dealNotes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "crm"."dealNotes_id_seq" TO "service_role";



GRANT ALL ON TABLE "crm"."deals" TO "anon";
GRANT ALL ON TABLE "crm"."deals" TO "authenticated";
GRANT ALL ON TABLE "crm"."deals" TO "service_role";



GRANT ALL ON SEQUENCE "crm"."deals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "crm"."deals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "crm"."deals_id_seq" TO "service_role";



GRANT ALL ON TABLE "crm"."favicons_excluded_domains" TO "anon";
GRANT ALL ON TABLE "crm"."favicons_excluded_domains" TO "authenticated";
GRANT ALL ON TABLE "crm"."favicons_excluded_domains" TO "service_role";



GRANT ALL ON SEQUENCE "crm"."favicons_excluded_domains_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "crm"."favicons_excluded_domains_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "crm"."favicons_excluded_domains_id_seq" TO "service_role";



GRANT ALL ON TABLE "crm"."sales" TO "anon";
GRANT ALL ON TABLE "crm"."sales" TO "authenticated";
GRANT ALL ON TABLE "crm"."sales" TO "service_role";



GRANT ALL ON TABLE "crm"."init_state" TO "anon";
GRANT ALL ON TABLE "crm"."init_state" TO "authenticated";
GRANT ALL ON TABLE "crm"."init_state" TO "service_role";



GRANT ALL ON SEQUENCE "crm"."sales_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "crm"."sales_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "crm"."sales_id_seq" TO "service_role";



GRANT ALL ON TABLE "crm"."tags" TO "anon";
GRANT ALL ON TABLE "crm"."tags" TO "authenticated";
GRANT ALL ON TABLE "crm"."tags" TO "service_role";



GRANT ALL ON SEQUENCE "crm"."tags_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "crm"."tags_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "crm"."tags_id_seq" TO "service_role";



GRANT ALL ON TABLE "crm"."tasks" TO "anon";
GRANT ALL ON TABLE "crm"."tasks" TO "authenticated";
GRANT ALL ON TABLE "crm"."tasks" TO "service_role";



GRANT ALL ON SEQUENCE "crm"."tasks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "crm"."tasks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "crm"."tasks_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "crm" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "crm" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "crm" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "crm" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "crm" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "crm" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "crm" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "crm" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "crm" GRANT ALL ON TABLES TO "service_role";



