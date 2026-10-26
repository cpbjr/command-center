"""In-memory CRM reads. Tests pass a fake book. No network client."""
from dataclasses import dataclass


DEFAULT_LIMIT = 25
MAX_LIMIT = 50


@dataclass
class Book:
    businesses: list
    contacts: list
    notes: list
    activity: list
    tasks: list


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


class CrmReader:
    """Read tools over one book. Business ids stay text. Contact ids stay numbers."""

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
        if want_business:
            businesses = [
                row for row in self.book.businesses
                if _contains(row.get("name"), query) or _contains(row.get("phone"), query)
            ]
        if want_contact:
            contacts = [row for row in self.book.contacts if self._contact_matches(row, query)]
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
        contact = next(
            (row for row in self.book.contacts if _contact_id(row.get("id")) == contact_id),
            None,
        )
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
