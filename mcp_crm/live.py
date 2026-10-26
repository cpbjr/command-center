"""Live CRM reads. The client is already scoped to schema wpa. No writes."""
from mcp_crm.reader import _blank, _contact_id, _contact_name, _result, clamp_limit


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

BUSINESS_COLUMNS = (
    "id,name,address,phone,website_url,gbp_categories,search_query,discovered_at,"
    "contact_status,discovery_rank,rank_total_candidates,google_maps_uri,business_status,"
    "rating,user_rating_count,notes,folder_path,lifecycle_stage,created_at,updated_at"
)
CONTACT_COLUMNS = (
    "id,business_id,client_id,name,last_name,role,phone,email,is_primary,notes,created_at,updated_at"
)
NOTE_COLUMNS = "id,contact_id,type,body,occurred_at,created_at"
ACTIVITY_COLUMNS = "id,business_id,type,summary,actor,occurred_at,created_at"
TASK_COLUMNS = (
    "id,business_id,client_id,project_id,title,description,category,status,priority,"
    "assigned_to,tags,due_date,completed_at,notes,created_at,updated_at"
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
    """Read tools over a schema-scoped client. Business ids stay text. Contact ids stay numbers."""

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
