# CRM MCP phone storage and writes implementation plan

**Date:** 2026-10-28
**Repo:** `/home/wpauser/src/command-center`
**Branch:** `feature/crm-mcp-phone-and-writes` (create after approve, not before)
**Planner:** Oscar
**Implementer:** Cody
**Reviewer:** Ricky
**Status:** approved 2026-10-28. Cody is on this plan. Do not apply the migration. Do not deploy.

**Goal:** Nancy can look up a caller by `+1` and ten digits, save a lead without a duplicate, and append a note. Buddy keeps full access and can read the client card.

**Done when:**

- [ ] A stored `(208) 938-0025` matches a search for `+12089380025`, `208-938-0025`, and `(208) 938-0025`
- [ ] Every non-empty `phone` in `wpa.wpa_businesses` and `wpa.wpa_contacts` is `+1` plus ten digits
- [ ] The contact form saves that form, and the list still shows `(208) 938-0025`
- [ ] Nancy's token can call only her allowlist, and the payload has four fields
- [ ] Buddy's token still calls the current read tools, plus the new writes, and `get_business` includes the active contract
- [ ] A note append does not change `wpa_contacts.notes`
- [ ] Reviewer read the git diff and signed off
- [ ] `.agent/Tasks/active.md` updated

**Out of scope:**

- Email or message send
- Delete of any row
- `convert_to_client` and `end_engagement`
- `move_to_stage` on a business that already exists
- A new column
- Rotating or revoking the Buddy token or the Nancy token
- Dashboard rsync
- Slimming Buddy's search payload

---

## Explanation

Nancy always searches for `+1` and ten digits. The book stores the display string. Search compares those raw strings, so `+12089380025` does not find `(208) 938-0025`.

Best practice is one stored form. Format it when you show it. Normalize it when you save it. The stored form is E.164, `+12089380025`. The display form is `(208) 938-0025`. The CRM already formats on the list and the lead card through `formatPhone`. The contact form does not. It saves whatever was typed.

This cut does both. The save path writes E.164. A one-time rewrite fixes the rows already stored. Search still compares digits, so a typed `(208)` number keeps matching after the rewrite. A check constraint stops the next save from putting the display string back.

Do not add a second phone column. One text column is enough if every write uses the same function.

The write tools are the other half. They land on records that already exist. A contact has no stage. Stage is `lifecycle_stage` on the business. A contact cannot be saved without a business. `business_id` is required.

Buddy is the current token whose label is `grok`. Do not rename that row. Nancy is the token whose label is `nancy`. Do not rotate either bearer.

Contact notes have no actor column. Do not add one. The caller is logged by the process. Activity already has `actor`. Tasks already have `tags`. Use those.

---

## Context (read first)

- `.agent/README.md`
- `.agent/Tasks/active.md`
- `mcp_crm/server.py`
- `mcp_crm/live.py`
- `mcp_crm/reader.py`
- `mcp_crm/tokens.py`
- `src/lib/format.ts`
- `src/components/contacts/ContactForm.tsx`
- `src/components/contacts/ContactNotes.tsx`

**Current state:** Search uses a raw substring match on `phone`. About 1,877 numbers are `(###) ###-####`. Two are ten digits. One is already `+1`. The contact form saves `phone.trim()`. List and card views call `formatPhone`. The live process has seven read tools. Writes are cut. Two bearers are in `wpa.mcp_api_tokens`. Labels are `grok` and `nancy`. The dead-column select fix is on the running container and on `feature/crm-mcp-drop-dead-columns`. It is not on `main`.

**Change:** Phones are stored as `+1` and ten digits. Search matches any punctuation of that number. Nancy can look up, create a lead, append a note, log a call, and create a task. She cannot read revenue, notes, address, ratings, or other contacts. Buddy keeps the current reads and gains the writes plus the client-card fields.

---

## Files

- Create: `supabase/migrations/YYYYMMDDHHMMSS_phone_e164.sql`
- Create: `src/lib/phone.ts`
- Modify: `src/lib/format.ts` (keep display formatting, call the same digit rule)
- Modify: `src/components/contacts/ContactForm.tsx` (show the formatted number, save E.164)
- Modify: `mcp_crm/reader.py` (digit compare for phone search)
- Modify: `mcp_crm/live.py` (same compare, plus writes and contract read)
- Modify: `mcp_crm/server.py` (new tools, Nancy allowlist, payload shape)
- Test: `tests/test_mcp_crm.py`
- Test: a vitest file next to `src/lib/phone.ts`
- Do not touch: `.github/workflows/deploy.yml`
- Do not touch: `src/components/leads/ConvertToClientDialog.tsx`

The new branch starts from `origin/main` and includes the dead-column select fix. A rebuild from `main` alone puts `contact_status` back.

---

## Record map

| Ask | Live record |
|---|---|
| first name | `wpa.wpa_contacts.name` |
| last name | `wpa.wpa_contacts.last_name` |
| contact phone | `wpa.wpa_contacts.phone` |
| business phone | `wpa.wpa_businesses.phone` |
| stage | `wpa.wpa_businesses.lifecycle_stage` |
| business source | `wpa.wpa_businesses.lead_source` |
| contact note | a new row in `wpa.wpa_contact_notes` |
| call in the feed | `wpa.append_activity` |
| follow-up task | a new row in `wpa.wpa_tasks` |
| service tier, contract status, monthly revenue, start date, current phase, next action, client notes, file folder | `wpa.wpa_contracts` |

Do not write `wpa_contacts.notes` on an update. Do not write `wpa_tasks.notes`. Do not raw-write `lifecycle_stage` to `client` or `relationship_ended`.

---

## Steps

### 1. Phone rule

**Files:** `src/lib/phone.ts`, `mcp_crm/reader.py`

**Do:** One rule in both languages. Strip every non-digit. If 11 digits start with 1, drop that 1. Ten digits become `+1` plus those digits. Anything else is not a phone. Empty stays empty.

**Verify:** The red test is a stored `(208) 938-0025` missed by `+12089380025`.

### 2. Search

**Files:** `mcp_crm/reader.py`, `mcp_crm/live.py`

**Do:** If the query becomes ten digits, match `phone` on those digits. Do not substring-match the raw `+1` string. A query that is not ten digits stays a name or email search. Match contact phones and business phones.

**Verify:** `+12089380025`, `208-938-0025`, and `(208) 938-0025` return the same contact. A different number does not.

### 3. CRM save

**Files:** `src/components/contacts/ContactForm.tsx`, `src/lib/phone.ts`

**Do:** The input shows `formatPhone`. The saved value is E.164. A value that is not ten digits does not save. Show the error. The known write is this form. The check constraint in step 5 is the lock for every other writer.

**Verify:** `npm test` covers `+1`, dashes, parentheses, and a reject.

### 4. Backfill

**Files:** `supabase/migrations/YYYYMMDDHHMMSS_phone_e164.sql`

**Do:** Rewrite non-empty phones that normalize to ten digits. Leave empty phones empty. Fail the migration if any non-empty phone does not normalize. Set `updated_at = now()` on each updated row. Do not apply this file until the save path is in the same ship. Apply with the hosted Supabase connector on `cfwaefobqjouyglocuyh`. Do not `db push` from this host.

**Verify:** A count of non-empty phones that are not `+1` and ten digits is 0. `public` has no phone rewrite.

### 5. Constraint

**Files:** the same migration, after the rewrite

**Do:** `phone` is null, empty, or `+1` and ten digits. This applies to `wpa.wpa_businesses` and `wpa.wpa_contacts`.

**Verify:** An insert of `(208) 938-0025` fails. An insert of `+12089380025` succeeds in the test double, not against live.

### 6. create_contact

**Files:** `mcp_crm/live.py`, `mcp_crm/server.py`

**Do:** Require a phone that normalizes. Match contacts on those ten digits. If one matches, return it. Do not update it. Do not change its business stage. If only the business phone matches, return that business's primary contact when one exists. If none exists, create the contact on that business. If no phone match, match `business_name` case-insensitive and exact. Attach the contact there. Do not change that stage. If no business matches, `business_name` is required. Create the business with `lifecycle_stage` `lead` and `lead_source` set to `source`. Then create the contact. `first_name` writes `name`. `last_name` writes `last_name`. If `notes` is set on a new contact, append a note row. Do not write `wpa_contacts.notes`. A missing `business_name` on a brand new number returns a clear error. Do not invent a business from the person's name.

**Verify:** A second create with the same `+1` number returns the first contact and does not insert another row.

### 7. add_contact_note

**Files:** `mcp_crm/live.py`, `mcp_crm/server.py`

**Do:** Insert one row in `wpa.wpa_contact_notes`. `type` is `note`. `body` is the note. `occurred_at` is now. Never update `wpa_contacts.notes`. Reject a body over 2,000 characters. Do not truncate. `source` is the caller label. Log it. Do not store it on the row. There is no actor column.

**Verify:** The contact `notes` text is unchanged after the append. A 2,001 character note returns an error and writes nothing.

### 8. log_activity

**Files:** `mcp_crm/live.py`

**Do:** Accept `contact_id` or `business_id`. Resolve a contact to its business. If both are passed, they must name the same business. Call `wpa.append_activity(business_id, type, summary, now, actor)`. `actor` is `nancy` or `buddy`. Do not raw-insert. `inbound_call` is a valid type. Cap `summary` at 2,000 characters.

**Verify:** A contact id writes an activity row on that contact's business. The actor is the token label.

### 9. create_task

**Files:** `mcp_crm/live.py`

**Do:** Resolve `contact_id` to `business_id` the same way. Insert a task with `title`, optional `due_date`, `status` `todo`, and `assigned_to` `human`. Add the caller label to `tags`. Do not set `notes`. Cap `title` at 2,000 characters.

**Verify:** The task is on the business. `notes` is empty. `assigned_to` is `human`.

### 10. update_contact

**Files:** `mcp_crm/server.py`, `mcp_crm/live.py`

**Do:** Buddy only. Allowed fields are `email`, `name`, `last_name`, and `role`. Reject every other field, including phone, notes, and stage. Nancy's token gets a clear error.

**Verify:** Nancy's call does not change the row. Buddy can change `role`.

### 11. Nancy scope

**Files:** `mcp_crm/server.py`

**Do:** Label `nancy` may call only `find_contact_by_phone`, `search`, `create_contact`, `add_contact_note`, `log_activity`, and `create_task`. Any other tool returns a clear error. `find_contact_by_phone` is the digit lookup. `search` still normalizes a `+1` query. Her payload from lookup, search, and create is contact id, first name, `lifecycle_stage` from the business, and business name. No phone, email, notes, address, rating, revenue, tasks, or other contacts. Label `grok` is Buddy. He keeps the current read tools and the new writes.

**Verify:** Nancy's search JSON has those four fields and no others. `get_business` on her token errors. Buddy's `search` still returns the current fields.

### 12. Buddy client details

**Files:** `mcp_crm/live.py`, `mcp_crm/server.py`

**Do:** On Buddy's `get_business`, attach the active contract. That is `wpa.wpa_contracts` where `status` is `active`, latest `start_date`. Fields are `service_tier`, `status`, `monthly_revenue`, `start_date`, `current_phase`, `next_action`, `notes`, and `folder_path`. Contract `status` is not the business stage. If there is no active contract, those fields are null. Do not create a contract. The server adds these fields only for Buddy.

**Verify:** A business with an active contract returns `service_tier` and `monthly_revenue` for Buddy. Nancy cannot call the tool.

### 13. Errors and logs

**Files:** `mcp_crm/server.py`

**Do:** Missing ids, bad phones, over-long text, and a tool Nancy cannot call return a clear message. A database error returns its message. Do not replace it with "Error executing tool". Log the tool name, the token label, the row id, and the timestamp. Do not log the bearer. Do not log the note body.

**Verify:** A bad phone on create returns the validation message and inserts nothing.

---

## Tests

**Command:** `env -u PYTHONPATH mcp_crm/.venv/bin/python -m pytest tests/test_mcp_crm.py -q`

**Also:** `npm test` for `src/lib/phone.ts`

The phone search test fails on current code. Cody runs it red, then implements, then runs the same command green. Unset `PYTHONPATH`. The Hermes shell points it at another site-packages.

Live check waits for ship. Search `+12089380025` against the Dog Zen contact. Do not dump the row in chat. No token still returns 401. Both existing bearers still return 200.

---

## Risks

- The backfill rewrites live phones. Ship it only with the save path and the constraint. A save path without the constraint lets the form put the old string back.
- A new business at stage `lead` is an insert. Do not call `move_to_stage` on a business that already exists. A matched client must stay a client.
- Nancy and Buddy share `search`. The server shapes her payload. A filter only in the reader will leak if Buddy and Nancy share the raw row.
- The dead-column fix is not on `main`. Leaving it off this branch restores the Dog Zen bug on the next image build.
- Contact notes will not show the caller in the CRM. The process log has the label. A visible caller on the note is a new column. It is not in this cut.

---

## Handoff

Implementer: follow this file. Do not expand scope. Do not search the tree for a second phone writer. The known UI write is `ContactForm.tsx`. The constraint covers the rest.

When code is in: run both test commands, then ask Ricky to review `git diff`.

This file does not approve Cody. It does not apply the migration. It does not deploy the process.
