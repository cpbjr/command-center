"""Live CRM reads and writes. The client is already scoped to schema wpa."""
import uuid

from mcp_crm.reader import (
    CONTRACT_FIELDS,
    UPDATE_FIELDS,
    _blank,
    _contact_id,
    _contact_name,
    _name_eq,
    _now,
    _result,
    clamp_limit,
    require_phone,
    require_text,
    ten_digits,
)


def _count_message(count: int, singular: str) -> str:
    if singular == "activity":
        noun = "activity" if count == 1 else "activities"
    elif singular == "business":
        noun = "business" if count == 1 else "businesses"
    else:
        noun = singular if count == 1 else f"{singular}s"
    return f"{count} {noun}"


BUSINESSES = "wpa_businesses"
CONTACTS = "wpa_contacts"
NOTES = "wpa_contact_notes"
ACTIVITY = "wpa_activity"
TASKS = "wpa_tasks"
CONTRACTS = "wpa_contracts"

BUSINESS_COLUMNS = (
    "id,name,address,phone,website_url,gbp_categories,search_query,discovered_at,"
    "discovery_rank,rank_total_candidates,google_maps_uri,business_status,"
    "rating,user_rating_count,notes,folder_path,lifecycle_stage,created_at,updated_at"
)
CONTACT_COLUMNS = (
    "id,business_id,name,last_name,role,phone,email,is_primary,notes,created_at,updated_at"
)
NOTE_COLUMNS = "id,contact_id,type,body,occurred_at,created_at"
ACTIVITY_COLUMNS = "id,business_id,type,summary,actor,occurred_at,created_at"
TASK_COLUMNS = (
    "id,business_id,project_id,title,description,category,status,priority,"
    "assigned_to,tags,due_date,completed_at,notes,created_at,updated_at"
)
CONTRACT_COLUMNS = (
    "business_id,service_tier,status,monthly_revenue,start_date,"
    "current_phase,next_action,notes,folder_path"
)


def _rows(response) -> list:
    data = getattr(response, "data", None)
    if not data:
        return []
    return [dict(row) for row in data]


def _without_raw(row: dict) -> dict:
    clean = dict(row)
    clean.pop("raw_data", None)
    return clean


def _business_row(row: dict) -> dict:
    clean = _without_raw(row)
    if clean.get("id") is not None:
        clean["id"] = str(clean["id"])
    return clean


def _contact_row(row: dict) -> dict:
    clean = _without_raw(row)
    if clean.get("id") is not None:
        clean["id"] = _contact_id(clean["id"])
    if clean.get("contact_id") is not None:
        clean["contact_id"] = _contact_id(clean["contact_id"])
    return clean


class SupabaseCrmReader:
    """Tools over a schema-scoped client. Business ids stay text. Contact ids stay numbers."""

    def __init__(self, client):
        self.client = client

    def search(self, query: str, type: str | None = None) -> dict:
        want_business = _blank(type) or type == "business"
        want_contact = _blank(type) or type == "contact"
        if type not in (None, "", "business", "contact"):
            want_business = False
            want_contact = False
        businesses = []
        contacts = []
        digits = ten_digits(query)
        if digits:
            if want_business:
                businesses = [
                    _business_row(row)
                    for row in self._select_all(BUSINESSES, BUSINESS_COLUMNS)
                    if ten_digits(row.get("phone")) == digits
                ]
            if want_contact:
                contacts = [
                    _contact_row(row)
                    for row in self._select_all(CONTACTS, CONTACT_COLUMNS)
                    if ten_digits(row.get("phone")) == digits
                ]
        else:
            if want_business:
                businesses = [
                    _business_row(row)
                    for row in self._ilike(BUSINESSES, ("name", "phone"), BUSINESS_COLUMNS, query)
                ]
            if want_contact:
                contacts = [
                    _contact_row(row)
                    for row in self._ilike(
                        CONTACTS,
                        ("name", "last_name", "email", "phone"),
                        CONTACT_COLUMNS,
                        query,
                    )
                ]
        return self._search_result(businesses, contacts)

    def get_business(self, id: str) -> dict:
        rows = _rows(
            self.client.table(BUSINESSES)
            .select(BUSINESS_COLUMNS)
            .eq("id", id)
            .limit(1)
            .execute()
        )
        if not rows:
            return _result(id, "Business not found", business=None, contacts=[], activity=[], tasks=[])
        business = _business_row(rows[0])
        contacts = [
            _contact_row(row)
            for row in _rows(
                self.client.table(CONTACTS)
                .select(CONTACT_COLUMNS)
                .eq("business_id", id)
                .execute()
            )
        ]
        activity = [
            _without_raw(row)
            for row in _rows(
                self.client.table(ACTIVITY)
                .select(ACTIVITY_COLUMNS)
                .eq("business_id", id)
                .order("occurred_at", desc=True)
                .execute()
            )
        ]
        tasks = [
            _without_raw(row)
            for row in _rows(
                self.client.table(TASKS)
                .select(TASK_COLUMNS)
                .eq("business_id", id)
                .execute()
            )
        ]
        return _result(
            business["id"],
            str(business.get("name") or business["id"]),
            business=business,
            contacts=contacts,
            activity=activity,
            tasks=tasks,
        )

    def get_contact(self, id: int) -> dict:
        contact_id = _contact_id(id)
        rows = _rows(
            self.client.table(CONTACTS)
            .select(CONTACT_COLUMNS)
            .eq("id", contact_id)
            .limit(1)
            .execute()
        )
        if not rows:
            return _result(contact_id, "Contact not found", contact=None, notes=[])
        contact = _contact_row(rows[0])
        notes = [
            _contact_row(row)
            for row in _rows(
                self.client.table(NOTES)
                .select(NOTE_COLUMNS)
                .eq("contact_id", contact_id)
                .execute()
            )
        ]
        return _result(
            contact["id"],
            _contact_name(contact) or "Contact",
            contact=contact,
            notes=notes,
        )

    def list_businesses(self, stage: str | None = None, limit: int = 25) -> dict:
        capped = clamp_limit(limit)
        query = self.client.table(BUSINESSES).select(BUSINESS_COLUMNS)
        if not _blank(stage):
            query = query.eq("lifecycle_stage", stage)
        rows = [_business_row(row) for row in _rows(query.limit(capped).execute())][:capped]
        row_id = rows[0]["id"] if rows else ""
        return _result(row_id, _count_message(len(rows), "business"), businesses=rows)

    def list_contacts(self, business_id: str | None = None, limit: int = 25) -> dict:
        capped = clamp_limit(limit)
        query = self.client.table(CONTACTS).select(CONTACT_COLUMNS)
        if not _blank(business_id):
            query = query.eq("business_id", business_id)
        rows = [_contact_row(row) for row in _rows(query.limit(capped).execute())][:capped]
        row_id = rows[0]["id"] if rows else ""
        return _result(row_id, _count_message(len(rows), "contact"), contacts=rows)

    def list_tasks(
        self,
        status: str | None = None,
        assigned_to: str | None = None,
        business_id: str | None = None,
        due_from: str | None = None,
        due_to: str | None = None,
        tag: str | None = None,
        limit: int = 25,
    ) -> dict:
        capped = clamp_limit(limit)
        query = self.client.table(TASKS).select(TASK_COLUMNS)
        if not _blank(status):
            query = query.eq("status", status)
        if not _blank(assigned_to):
            query = query.eq("assigned_to", str(assigned_to))
        if not _blank(business_id):
            query = query.eq("business_id", business_id)
        if due_from:
            query = query.gte("due_date", due_from)
        if due_to:
            query = query.lte("due_date", due_to)
        if tag:
            query = query.contains("tags", [tag])
        rows = [_without_raw(row) for row in _rows(query.limit(capped).execute())][:capped]
        row_id = rows[0]["id"] if rows else ""
        return _result(row_id, _count_message(len(rows), "task"), tasks=rows)

    def list_activity(self, business_id: str) -> dict:
        rows = [
            _without_raw(row)
            for row in _rows(
                self.client.table(ACTIVITY)
                .select(ACTIVITY_COLUMNS)
                .eq("business_id", business_id)
                .order("occurred_at", desc=True)
                .execute()
            )
        ]
        row_id = rows[0]["id"] if rows else ""
        return _result(row_id, _count_message(len(rows), "activity"), activity=rows)

    def business_card(self, business_id: str) -> dict:
        rows = _rows(
            self.client.table(BUSINESSES)
            .select("id,name,lifecycle_stage")
            .eq("id", business_id)
            .limit(1)
            .execute()
        )
        if not rows:
            return {"name": None, "lifecycle_stage": None}
        return {"name": rows[0].get("name"), "lifecycle_stage": rows[0].get("lifecycle_stage")}

    def primary_contact(self, business_id: str):
        rows = [
            _contact_row(row)
            for row in _rows(
                self.client.table(CONTACTS)
                .select(CONTACT_COLUMNS)
                .eq("business_id", business_id)
                .eq("is_primary", True)
                .limit(1)
                .execute()
            )
        ]
        return rows[0] if rows else None

    def active_contract(self, business_id: str) -> dict | None:
        rows = _rows(
            self.client.table(CONTRACTS)
            .select(CONTRACT_COLUMNS)
            .eq("business_id", business_id)
            .eq("status", "active")
            .order("start_date", desc=True)
            .limit(1)
            .execute()
        )
        if not rows:
            return None
        return {key: rows[0].get(key) for key in CONTRACT_FIELDS}

    def find_contact_by_phone(self, phone: str) -> dict:
        stored = require_phone(phone)
        digits = ten_digits(stored)
        matches = [
            _contact_row(row)
            for row in self._select_all(CONTACTS, CONTACT_COLUMNS)
            if ten_digits(row.get("phone")) == digits
        ]
        if matches:
            contact = matches[0]
            return _result(
                contact["id"],
                _contact_name(contact) or "Contact",
                contact=contact,
                contacts=matches,
            )
        businesses = [
            _business_row(row)
            for row in self._select_all(BUSINESSES, BUSINESS_COLUMNS)
            if ten_digits(row.get("phone")) == digits
        ]
        if businesses:
            primary = self.primary_contact(businesses[0]["id"])
            if primary is not None:
                return _result(
                    primary["id"],
                    _contact_name(primary) or "Contact",
                    contact=primary,
                    contacts=[primary],
                )
        return _result("", "No matches", contact=None, contacts=[])

    def create_contact(
        self,
        phone: str,
        first_name: str | None = None,
        last_name: str | None = None,
        business_name: str | None = None,
        source: str | None = None,
        notes: str | None = None,
    ) -> dict:
        stored = require_phone(phone)
        digits = ten_digits(stored)
        existing = next(
            (
                _contact_row(row)
                for row in self._select_all(CONTACTS, CONTACT_COLUMNS)
                if ten_digits(row.get("phone")) == digits
            ),
            None,
        )
        if existing is not None:
            return self._unchanged_contact(existing)
        businesses = [
            _business_row(row) for row in self._select_all(BUSINESSES, BUSINESS_COLUMNS)
        ]
        by_phone = next((row for row in businesses if ten_digits(row.get("phone")) == digits), None)
        if by_phone is not None:
            primary = self.primary_contact(by_phone["id"])
            if primary is not None:
                return self._unchanged_contact(primary)
            return self._insert_contact(by_phone["id"], first_name, last_name, stored, notes)
        if not _blank(business_name):
            named = next((row for row in businesses if _name_eq(row.get("name"), business_name)), None)
            if named is not None:
                return self._insert_contact(named["id"], first_name, last_name, stored, notes)
        if _blank(business_name):
            raise ValueError("A new number needs a business_name")
        business = self._insert_business(str(business_name), source)
        return self._insert_contact(business["id"], first_name, last_name, stored, notes)

    def add_contact_note(self, contact_id: int, body: str, now: str | None = None) -> dict:
        text = require_text(body, "Note body")
        contact = self._contact_by_id(contact_id)
        if contact is None:
            raise ValueError("Contact not found")
        inserted = self._insert(NOTES, {
            "contact_id": _contact_id(contact_id),
            "type": "note",
            "body": text,
            "occurred_at": now or _now(),
        })
        note = _contact_row(inserted)
        return _result(note.get("id"), "Note added", note=note)

    def log_activity(
        self,
        activity_type: str,
        summary: str,
        actor: str,
        contact_id: int | None = None,
        business_id: str | None = None,
        now: str | None = None,
    ) -> dict:
        text = require_text(summary, "Summary")
        resolved = self._resolve_business(contact_id, business_id)
        occurred = now or _now()
        response = self.client.rpc("append_activity", {
            "p_business_id": resolved,
            "p_type": activity_type,
            "p_summary": text,
            "p_occurred_at": occurred,
            "p_actor": actor,
        }).execute()
        rows = _rows(response)
        row = _without_raw(rows[0]) if rows else {
            "id": "",
            "business_id": resolved,
            "type": activity_type,
            "summary": text,
            "occurred_at": occurred,
            "actor": actor,
        }
        return _result(row.get("id") or resolved, "Activity logged", activity=row)

    def create_task(
        self,
        title: str,
        caller_label: str,
        contact_id: int | None = None,
        business_id: str | None = None,
        due_date: str | None = None,
    ) -> dict:
        text = require_text(title, "Title")
        resolved = self._resolve_business(contact_id, business_id)
        payload = {
            "business_id": resolved,
            "title": text,
            "status": "todo",
            "assigned_to": "human",
            "tags": [caller_label] if caller_label else [],
        }
        if due_date:
            payload["due_date"] = due_date
        inserted = self._insert(TASKS, payload)
        task = _without_raw(inserted)
        return _result(task.get("id") or resolved, "Task created", task=task)

    def update_contact(self, contact_id: int, fields: dict) -> dict:
        unknown = sorted(set(fields) - set(UPDATE_FIELDS))
        if unknown:
            raise ValueError(f"Cannot update {', '.join(unknown)}")
        if not fields:
            raise ValueError("No fields to update")
        contact = self._contact_by_id(contact_id)
        if contact is None:
            raise ValueError("Contact not found")
        wanted = _contact_id(contact_id)
        rows = _rows(
            self.client.table(CONTACTS)
            .update(dict(fields))
            .eq("id", wanted)
            .execute()
        )
        updated = _contact_row(rows[0]) if rows else {**contact, **fields}
        return _result(updated.get("id", wanted), _contact_name(updated) or "Contact", contact=updated)

    def _insert_business(self, name: str, source: str | None) -> dict:
        inserted = self._insert(BUSINESSES, {
            "id": str(uuid.uuid4()),
            "name": name,
            "lifecycle_stage": "lead",
            "lead_source": source,
        })
        return _business_row(inserted)

    def _insert_contact(self, business_id: str, first_name, last_name, phone: str, notes: str | None) -> dict:
        if notes:
            require_text(notes, "Note body")
        inserted = self._insert(CONTACTS, {
            "business_id": business_id,
            "name": first_name or "",
            "last_name": last_name or "",
            "phone": phone,
            "is_primary": False,
        })
        contact = _contact_row(inserted)
        if notes:
            self._insert(NOTES, {
                "contact_id": contact["id"],
                "type": "note",
                "body": notes,
                "occurred_at": _now(),
            })
        return _result(contact["id"], _contact_name(contact) or "Contact", contact=contact, created=True)

    def _unchanged_contact(self, contact: dict) -> dict:
        return _result(
            contact["id"],
            _contact_name(contact) or "Contact",
            contact=contact,
            created=False,
        )

    def _resolve_business(self, contact_id, business_id) -> str:
        if contact_id is None and _blank(business_id):
            raise ValueError("contact_id or business_id is required")
        resolved = None
        if contact_id is not None:
            contact = self._contact_by_id(contact_id)
            if contact is None:
                raise ValueError("Contact not found")
            resolved = contact.get("business_id")
            if _blank(resolved):
                raise ValueError("Contact has no business")
        if not _blank(business_id):
            if resolved is not None and resolved != business_id:
                raise ValueError("contact_id and business_id do not match")
            if self._business_by_id(business_id) is None:
                raise ValueError("Business not found")
            return business_id
        if resolved is None:
            raise ValueError("Contact has no business")
        return str(resolved)

    def _contact_by_id(self, contact_id):
        wanted = _contact_id(contact_id)
        rows = _rows(
            self.client.table(CONTACTS)
            .select(CONTACT_COLUMNS)
            .eq("id", wanted)
            .limit(1)
            .execute()
        )
        return _contact_row(rows[0]) if rows else None

    def _business_by_id(self, business_id):
        rows = _rows(
            self.client.table(BUSINESSES)
            .select("id,name,lifecycle_stage")
            .eq("id", business_id)
            .limit(1)
            .execute()
        )
        return _business_row(rows[0]) if rows else None

    def _insert(self, table: str, row: dict) -> dict:
        response = self.client.table(table).insert(dict(row)).execute()
        rows = _rows(response)
        if rows:
            return rows[0]
        return dict(row)

    def _select_all(self, table: str, select: str) -> list:
        return _rows(self.client.table(table).select(select).execute())

    def _search_result(self, businesses: list, contacts: list) -> dict:
        if businesses:
            row_id = businesses[0]["id"]
        elif contacts:
            row_id = contacts[0]["id"]
        else:
            row_id = ""
        if not businesses and not contacts:
            message = "No matches"
        elif businesses and not contacts:
            message = f"Found {businesses[0].get('name') or businesses[0]['id']}"
        elif contacts and not businesses:
            message = f"Found {_contact_name(contacts[0]) or contacts[0]['id']}"
        else:
            message = f"Found {len(businesses)} businesses and {len(contacts)} contacts"
        return _result(row_id, message, businesses=businesses, contacts=contacts)

    def _ilike(self, table: str, columns: tuple, select: str, query: str) -> list:
        pattern = f"%{query}%"
        found = []
        seen = set()
        for column in columns:
            for row in _rows(
                self.client.table(table).select(select).ilike(column, pattern).execute()
            ):
                key = row.get("id")
                if key in seen:
                    continue
                seen.add(key)
                found.append(row)
        return found
