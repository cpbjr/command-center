"""In-memory CRM reads and writes. Tests pass a fake book. No network client."""
from dataclasses import dataclass
from datetime import datetime, timezone

DEFAULT_LIMIT = 25
MAX_LIMIT = 50
MAX_TEXT = 2000

PHONE_ERROR = "Phone must be +1 and ten digits"
NEW_NUMBER_NEEDS_BUSINESS = "A new number needs a business_name"
UPDATE_FIELDS = ("email", "name", "last_name", "role")
CONTRACT_FIELDS = (
    "service_tier",
    "status",
    "monthly_revenue",
    "start_date",
    "current_phase",
    "next_action",
    "notes",
    "folder_path",
)


@dataclass
class Book:
    businesses: list
    contacts: list
    notes: list
    activity: list
    tasks: list
    contracts: list | None = None


def clamp_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_LIMIT
    return max(1, min(int(limit), MAX_LIMIT))


def _blank(value) -> bool:
    return value is None or value == ""


def _contains(value, query: str) -> bool:
    if value is None:
        return False
    return query.casefold() in str(value).casefold()


def _contact_id(value):
    if isinstance(value, bool):
        raise TypeError("contact id must be a number")
    if isinstance(value, int):
        return value
    return int(value)


def _contact_name(row: dict) -> str:
    return f"{row.get('name') or ''} {row.get('last_name') or ''}".strip()


def _count_message(count: int, singular: str) -> str:
    noun = singular if count == 1 else f"{singular}s"
    if singular == "activity":
        noun = "activity" if count == 1 else "activities"
    return f"{count} {noun}"


def _result(row_id, message: str, **extra) -> dict:
    return {"id": row_id, "message": message, **extra}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ten_digits(value) -> str | None:
    """Ten US digits, or None when the value is not a phone."""
    if value is None:
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return digits
    return None


def to_e164(value) -> str | None:
    """Empty stays ''. Ten digits become +1 plus those digits. Anything else is None."""
    if value is None:
        return ""
    if isinstance(value, str) and value.strip() == "":
        return ""
    digits = ten_digits(value)
    if digits is None:
        return None
    return "+1" + digits


def require_phone(value) -> str:
    stored = to_e164(value)
    if not stored:
        raise ValueError(PHONE_ERROR)
    return stored


def require_text(value, label: str) -> str:
    if value is None or value == "":
        raise ValueError(f"{label} is required")
    if len(value) > MAX_TEXT:
        raise ValueError(f"{label} is over 2000 characters")
    return value


def _name_eq(left, right) -> bool:
    return str(left or "").casefold() == str(right or "").casefold()


class CrmReader:
    """Tools over one book. Business ids stay text. Contact ids stay numbers."""

    def __init__(self, book: Book):
        self.book = book

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
                    row for row in self.book.businesses
                    if ten_digits(row.get("phone")) == digits
                ]
            if want_contact:
                contacts = [
                    row for row in self.book.contacts
                    if ten_digits(row.get("phone")) == digits
                ]
        else:
            if want_business:
                businesses = [
                    row for row in self.book.businesses
                    if _contains(row.get("name"), query) or _contains(row.get("phone"), query)
                ]
            if want_contact:
                contacts = [row for row in self.book.contacts if self._contact_matches(row, query)]
        return self._search_result(businesses, contacts)

    def get_business(self, id: str) -> dict:
        business = next((row for row in self.book.businesses if row.get("id") == id), None)
        contacts = [row for row in self.book.contacts if row.get("business_id") == id]
        activity = [row for row in self.book.activity if row.get("business_id") == id]
        tasks = [row for row in self.book.tasks if row.get("business_id") == id]
        if business is None:
            return _result(id, "Business not found", business=None, contacts=[], activity=[], tasks=[])
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
        contact = self._find_contact(contact_id)
        notes = [
            row for row in self.book.notes
            if _contact_id(row.get("contact_id")) == contact_id
        ]
        if contact is None:
            return _result(contact_id, "Contact not found", contact=None, notes=[])
        return _result(contact["id"], _contact_name(contact) or "Contact", contact=contact, notes=notes)

    def list_businesses(self, stage: str | None = None, limit: int = DEFAULT_LIMIT) -> dict:
        rows = list(self.book.businesses)
        if not _blank(stage):
            rows = [row for row in rows if row.get("lifecycle_stage") == stage]
        rows = rows[:clamp_limit(limit)]
        row_id = rows[0]["id"] if rows else ""
        return _result(row_id, _count_message(len(rows), "business"), businesses=rows)

    def list_contacts(self, business_id: str | None = None, limit: int = DEFAULT_LIMIT) -> dict:
        rows = list(self.book.contacts)
        if not _blank(business_id):
            rows = [row for row in rows if row.get("business_id") == business_id]
        rows = rows[:clamp_limit(limit)]
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
        limit: int = DEFAULT_LIMIT,
    ) -> dict:
        rows = []
        for row in self.book.tasks:
            if not _blank(status) and row.get("status") != status:
                continue
            if not _blank(assigned_to) and str(row.get("assigned_to")) != str(assigned_to):
                continue
            if not _blank(business_id) and row.get("business_id") != business_id:
                continue
            due = row.get("due_date") or ""
            if due_from and due < due_from:
                continue
            if due_to and due > due_to:
                continue
            if tag and not self._has_tag(row, tag):
                continue
            rows.append(row)
        rows = rows[:clamp_limit(limit)]
        row_id = rows[0]["id"] if rows else ""
        return _result(row_id, _count_message(len(rows), "task"), tasks=rows)

    def list_activity(self, business_id: str) -> dict:
        rows = [row for row in self.book.activity if row.get("business_id") == business_id]
        row_id = rows[0]["id"] if rows else ""
        return _result(row_id, _count_message(len(rows), "activity"), activity=rows)

    def business_card(self, business_id: str) -> dict:
        row = self._find_business(business_id)
        if row is None:
            return {"name": None, "lifecycle_stage": None}
        return {"name": row.get("name"), "lifecycle_stage": row.get("lifecycle_stage")}

    def primary_contact(self, business_id: str):
        return next(
            (
                row for row in self.book.contacts
                if row.get("business_id") == business_id and row.get("is_primary")
            ),
            None,
        )

    def active_contract(self, business_id: str) -> dict | None:
        rows = [
            row for row in (self.book.contracts or [])
            if row.get("business_id") == business_id and row.get("status") == "active"
        ]
        if not rows:
            return None
        rows.sort(key=lambda row: row.get("start_date") or "", reverse=True)
        chosen = rows[0]
        return {key: chosen.get(key) for key in CONTRACT_FIELDS}

    def find_contact_by_phone(self, phone: str) -> dict:
        stored = require_phone(phone)
        digits = ten_digits(stored)
        matches = [row for row in self.book.contacts if ten_digits(row.get("phone")) == digits]
        if matches:
            contact = matches[0]
            return _result(
                contact["id"],
                _contact_name(contact) or "Contact",
                contact=contact,
                contacts=matches,
            )
        businesses = [row for row in self.book.businesses if ten_digits(row.get("phone")) == digits]
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
            (row for row in self.book.contacts if ten_digits(row.get("phone")) == digits),
            None,
        )
        if existing is not None:
            return self._unchanged_contact(existing)
        by_business_phone = next(
            (row for row in self.book.businesses if ten_digits(row.get("phone")) == digits),
            None,
        )
        if by_business_phone is not None:
            primary = self.primary_contact(by_business_phone["id"])
            if primary is not None:
                return self._unchanged_contact(primary)
            return self._insert_contact(
                by_business_phone["id"],
                first_name,
                last_name,
                stored,
                notes,
            )
        if not _blank(business_name):
            named = next(
                (row for row in self.book.businesses if _name_eq(row.get("name"), business_name)),
                None,
            )
            if named is not None:
                return self._insert_contact(named["id"], first_name, last_name, stored, notes)
        if _blank(business_name):
            raise ValueError(NEW_NUMBER_NEEDS_BUSINESS)
        business = self._insert_business(str(business_name), source)
        return self._insert_contact(business["id"], first_name, last_name, stored, notes)

    def add_contact_note(self, contact_id: int, body: str, now: str | None = None) -> dict:
        text = require_text(body, "Note body")
        contact = self._find_contact(contact_id)
        if contact is None:
            raise ValueError("Contact not found")
        before = contact.get("notes")
        row = {
            "id": self._next_number(self.book.notes),
            "contact_id": _contact_id(contact_id),
            "type": "note",
            "body": text,
            "occurred_at": now or _now(),
        }
        self.book.notes.append(row)
        if contact.get("notes") != before:
            raise RuntimeError("contact notes changed")
        return _result(row["id"], "Note added", note=row)

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
        row = self._append_activity(resolved, activity_type, text, occurred, actor)
        return _result(row["id"], "Activity logged", activity=row)

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
        row = {
            "id": self._next_text_id(self.book.tasks, "task"),
            "business_id": resolved,
            "title": text,
            "status": "todo",
            "assigned_to": "human",
            "tags": [caller_label] if caller_label else [],
        }
        if due_date:
            row["due_date"] = due_date
        self.book.tasks.append(row)
        return _result(row["id"], "Task created", task=row)

    def update_contact(self, contact_id: int, fields: dict) -> dict:
        unknown = sorted(set(fields) - set(UPDATE_FIELDS))
        if unknown:
            raise ValueError(f"Cannot update {', '.join(unknown)}")
        if not fields:
            raise ValueError("No fields to update")
        contact = self._find_contact(contact_id)
        if contact is None:
            raise ValueError("Contact not found")
        for key, value in fields.items():
            contact[key] = value
        return _result(contact["id"], _contact_name(contact) or "Contact", contact=contact)

    def _append_activity(self, business_id: str, activity_type: str, summary: str, occurred: str, actor: str) -> dict:
        row = {
            "id": self._next_text_id(self.book.activity, "act"),
            "business_id": business_id,
            "type": activity_type,
            "summary": summary,
            "occurred_at": occurred,
            "actor": actor,
        }
        self.book.activity.append(row)
        return row

    def _insert_business(self, name: str, source: str | None) -> dict:
        row = {
            "id": self._next_text_id(self.book.businesses, "biz"),
            "name": name,
            "lifecycle_stage": "lead",
            "lead_source": source,
            "phone": "",
        }
        self.book.businesses.append(row)
        return row

    def _insert_contact(self, business_id: str, first_name, last_name, phone: str, notes: str | None) -> dict:
        if notes:
            require_text(notes, "Note body")
        row = {
            "id": self._next_number(self.book.contacts),
            "business_id": business_id,
            "name": first_name or "",
            "last_name": last_name or "",
            "phone": phone,
            "is_primary": False,
        }
        self.book.contacts.append(row)
        if notes:
            self.book.notes.append({
                "id": self._next_number(self.book.notes),
                "contact_id": row["id"],
                "type": "note",
                "body": notes,
                "occurred_at": _now(),
            })
        return _result(row["id"], _contact_name(row) or "Contact", contact=row, created=True)

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
            contact = self._find_contact(contact_id)
            if contact is None:
                raise ValueError("Contact not found")
            resolved = contact.get("business_id")
            if _blank(resolved):
                raise ValueError("Contact has no business")
        if not _blank(business_id):
            if resolved is not None and resolved != business_id:
                raise ValueError("contact_id and business_id do not match")
            if self._find_business(business_id) is None:
                raise ValueError("Business not found")
            return business_id
        if resolved is None:
            raise ValueError("Contact has no business")
        return str(resolved)

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

    def _find_contact(self, contact_id):
        wanted = _contact_id(contact_id)
        return next(
            (row for row in self.book.contacts if _contact_id(row.get("id")) == wanted),
            None,
        )

    def _find_business(self, business_id):
        return next((row for row in self.book.businesses if row.get("id") == business_id), None)

    def _next_number(self, rows: list) -> int:
        nums = []
        for row in rows:
            value = row.get("id")
            if isinstance(value, int) and not isinstance(value, bool):
                nums.append(value)
        return (max(nums) if nums else 0) + 1

    def _next_text_id(self, rows: list, prefix: str) -> str:
        best = 0
        head = f"{prefix}-"
        for row in rows:
            text = str(row.get("id") or "")
            if text.startswith(head) and text[len(head):].isdigit():
                best = max(best, int(text[len(head):]))
        return f"{prefix}-{best + 1}"

    def _contact_matches(self, row: dict, query: str) -> bool:
        return (
            _contains(row.get("name"), query)
            or _contains(row.get("last_name"), query)
            or _contains(_contact_name(row), query)
            or _contains(row.get("email"), query)
            or _contains(row.get("phone"), query)
        )

    def _has_tag(self, row: dict, tag: str) -> bool:
        tags = row.get("tags")
        if tags is None:
            return False
        if isinstance(tags, str):
            return tag == tags or tag in [part.strip() for part in tags.split(",")]
        return tag in tags
