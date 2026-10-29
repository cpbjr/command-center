"""Read-only CRM MCP. Fake book only. No live Supabase."""
import copy
import json
import logging
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from mcp_crm.reader import Book, CrmReader, to_e164
from mcp_crm.server import build_app, build_server
from mcp_crm.tokens import MemoryTokenStore


PUBLIC_URL = "https://whitepine-tech.com/crm/mcp"
SUBJECT = "1500630701589008444"
ROOT = Path(__file__).resolve().parents[1]

READ_TOOLS = {
    "search",
    "get_business",
    "get_contact",
    "list_businesses",
    "list_contacts",
    "list_tasks",
    "list_activity",
}

WRITE_TOOLS = {
    "find_contact_by_phone",
    "create_contact",
    "add_contact_note",
    "log_activity",
    "create_task",
    "update_contact",
}

ALL_TOOLS = READ_TOOLS | WRITE_TOOLS

WRITE_WORDS = (
    "create",
    "update",
    "delete",
    "archive",
    "add",
    "set",
    "move",
    "insert",
    "write",
    "upsert",
    "patch",
    "remove",
)

BOOK = Book(
    businesses=[
        {
            "id": "biz-pine",
            "name": "Pine Valley",
            "phone": "555-0100",
            "website_url": "https://pine.example",
            "lifecycle_stage": "client",
        },
        {
            "id": "biz-oak",
            "name": "Oak Hill",
            "phone": "555-0199",
            "website_url": "https://oak.example",
            "lifecycle_stage": "lead",
        },
    ],
    contacts=[
        {
            "id": 10,
            "business_id": "biz-pine",
            "name": "Ada",
            "last_name": "Lovelace",
            "email": "ada@pine.example",
            "phone": "555-0111",
        },
        {
            "id": 11,
            "business_id": "biz-oak",
            "name": "Grace",
            "last_name": "Hopper",
            "email": "grace@oak.example",
            "phone": "555-0122",
        },
    ],
    notes=[
        {"id": 1, "contact_id": 10, "body": "Met at the clubhouse."},
    ],
    activity=[
        {
            "id": "act-1",
            "business_id": "biz-pine",
            "summary": "Called about greens.",
            "actor": "chris",
        },
    ],
    tasks=[
        {
            "id": "task-1",
            "business_id": "biz-pine",
            "assigned_to": SUBJECT,
            "tags": ["greens", "follow-up"],
            "due_date": "2026-11-01",
            "status": "open",
            "title": "Follow up",
        },
        {
            "id": "task-2",
            "business_id": "biz-oak",
            "assigned_to": "other",
            "tags": ["billing"],
            "due_date": "2026-12-15",
            "status": "done",
            "title": "Send invoice",
        },
    ],
)


def _reader(book=BOOK):
    return CrmReader(book)


def _app(store, book=BOOK):
    return build_app(store, _reader(book), public_url=PUBLIC_URL)


def _headers(token=None, session_id=None):
    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if session_id:
        headers["mcp-session-id"] = session_id
    return headers


def _post(client, method, params=None, *, token=None, session_id=None, rpc_id=1, path="/crm/mcp"):
    body = {"jsonrpc": "2.0", "method": method}
    if rpc_id is not None:
        body["id"] = rpc_id
    if params is not None:
        body["params"] = params
    return client.post(path, headers=_headers(token, session_id), json=body)


def _payload(response):
    assert response.status_code == 200, response.text
    body = response.json()
    assert "error" not in body, body
    result = body["result"]
    structured = result.get("structuredContent")
    if isinstance(structured, dict) and structured:
        return structured
    content = result.get("content") or []
    assert content, result
    return json.loads(content[0]["text"])


class McpSession:
    def __init__(self, app, token):
        self.app = app
        self.token = token
        self.client = None
        self.session_id = None
        self._rpc = 0

    def __enter__(self):
        self.client = TestClient(self.app)
        self.client.__enter__()
        init = self.request(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "0"},
            },
        )
        assert init.status_code == 200, init.text
        self.session_id = init.headers.get("mcp-session-id") or self.session_id
        note = _post(
            self.client,
            "notifications/initialized",
            token=self.token,
            session_id=self.session_id,
            rpc_id=None,
        )
        assert note.status_code in (200, 202), note.text
        return self

    def __exit__(self, exc_type, exc, tb):
        return self.client.__exit__(exc_type, exc, tb)

    def request(self, method, params=None):
        self._rpc += 1
        response = _post(
            self.client,
            method,
            params,
            token=self.token,
            session_id=self.session_id,
            rpc_id=self._rpc,
        )
        found = response.headers.get("mcp-session-id")
        if found:
            self.session_id = found
        return response

    def call(self, name, arguments=None):
        response = self.request("tools/call", {"name": name, "arguments": arguments or {}})
        return _payload(response)


def _mint():
    store = MemoryTokenStore()
    raw, record = store.mint(SUBJECT, "test")
    return store, raw, record


def test_live_selects_omit_dropped_columns():
    from mcp_crm.live import BUSINESS_COLUMNS, CONTACT_COLUMNS, TASK_COLUMNS

    assert "contact_status" not in BUSINESS_COLUMNS
    assert "lifecycle_stage" in BUSINESS_COLUMNS
    assert "client_id" not in CONTACT_COLUMNS
    assert "client_id" not in TASK_COLUMNS


def test_no_bearer_is_401():
    app = _app(MemoryTokenStore())
    with TestClient(app) as client:
        response = _post(
            client,
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "0"},
            },
        )
    assert response.status_code == 401


def test_revoked_token_fails():
    store, raw, record = _mint()
    assert raw.startswith("crm_")
    assert record.user_id == SUBJECT
    assert record.token_hash != raw
    assert store.revoke(record.token_id) is True
    assert store.verify(raw) is None
    app = _app(store)
    with TestClient(app) as client:
        response = _post(
            client,
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "0"},
            },
            token=raw,
        )
    assert response.status_code == 401


def test_seven_read_tools_return_id_and_message_and_no_write_tool():
    store, raw, _record = _mint()
    app = _app(store)
    with McpSession(app, raw) as mcp:
        listed = mcp.request("tools/list")
        body = listed.json()
        names = {tool["name"] for tool in body["result"]["tools"]}
        assert names == ALL_TOOLS
        for name in READ_TOOLS:
            lowered = name.lower()
            assert not any(word in lowered for word in WRITE_WORDS)

        found = mcp.call("search", {"query": "Pine"})
        assert found["id"] == "biz-pine"
        assert found["message"]
        assert any(row["id"] == "biz-pine" for row in found["businesses"])

        by_email = mcp.call("search", {"query": "ada@pine.example"})
        assert by_email["id"] == 10
        assert isinstance(by_email["id"], int)
        assert by_email["message"]

        business_only = mcp.call("search", {"query": "Ada", "type": "business"})
        assert business_only["businesses"] == []
        assert business_only["contacts"] == []
        assert "message" in business_only

        contact_only = mcp.call("search", {"query": "555-0100", "type": "contact"})
        assert contact_only["contacts"] == []
        assert "id" in contact_only
        assert contact_only["message"]

        business = mcp.call("get_business", {"id": "biz-pine"})
        assert business["id"] == "biz-pine"
        assert isinstance(business["id"], str)
        assert business["message"]
        assert any(row["id"] == 10 for row in business["contacts"])
        assert any(row["summary"] == "Called about greens." for row in business["activity"])
        assert any(row["id"] == "task-1" for row in business["tasks"])
        assert "clubhouse" not in json.dumps(business["activity"])

        contact = mcp.call("get_contact", {"id": 10})
        assert contact["id"] == 10
        assert isinstance(contact["id"], int)
        assert contact["message"]
        assert any("clubhouse" in row["body"] for row in contact["notes"])

        leads = mcp.call("list_businesses", {"stage": "lead"})
        assert leads["id"] == "biz-oak"
        assert leads["message"]
        assert [row["id"] for row in leads["businesses"]] == ["biz-oak"]

        people = mcp.call("list_contacts", {"business_id": "biz-pine"})
        assert people["id"] == 10
        assert isinstance(people["id"], int)
        assert people["message"]
        assert [row["id"] for row in people["contacts"]] == [10]

        tasks = mcp.call(
            "list_tasks",
            {"tag": "greens", "assigned_to": SUBJECT, "status": "open"},
        )
        assert tasks["id"] == "task-1"
        assert tasks["message"]
        assert [row["id"] for row in tasks["tasks"]] == ["task-1"]

        due = mcp.call("list_tasks", {"due_from": "2026-11-01", "due_to": "2026-11-01"})
        assert [row["id"] for row in due["tasks"]] == ["task-1"]
        assert due["message"]

        activity = mcp.call("list_activity", {"business_id": "biz-pine"})
        assert activity["id"] == "act-1"
        assert activity["message"]
        dumped = json.dumps(activity)
        assert "Called about greens." in dumped
        assert "clubhouse" not in dumped
        assert "actor" in activity["activity"][0]


def test_limit_defaults_to_25_and_caps_at_50():
    businesses = [
        {
            "id": f"biz-{index}",
            "name": f"Course {index}",
            "phone": f"555-{index:04d}",
            "website_url": None,
            "lifecycle_stage": "identified",
        }
        for index in range(60)
    ]
    book = Book(businesses=businesses, contacts=[], notes=[], activity=[], tasks=[])
    store, raw, _record = _mint()
    app = _app(store, book)
    with McpSession(app, raw) as mcp:
        defaulted = mcp.call("list_businesses", {})
        capped = mcp.call("list_businesses", {"limit": 100})
    assert len(defaulted["businesses"]) == 25
    assert defaulted["id"] == "biz-0"
    assert defaulted["message"]
    assert len(capped["businesses"]) == 50
    assert capped["message"]


def test_registered_tools_match_the_http_list():
    server = build_server(MemoryTokenStore(), _reader(), public_url=PUBLIC_URL)
    names = {tool.name for tool in server._tool_manager.list_tools()}
    assert names == ALL_TOOLS


def test_migration_file_exists_and_is_not_a_live_apply():
    path = ROOT / "supabase" / "migrations" / "20261025120000_wpa_mcp_api_tokens.sql"
    text = path.read_text()
    assert "CREATE TABLE IF NOT EXISTS wpa.mcp_api_tokens" in text
    assert "user_id TEXT NOT NULL" in text
    assert "ENABLE ROW LEVEL SECURITY" in text
    assert "bookkeeping" not in text
    assert "public.mcp_api_tokens" not in text
    assert "CREATE POLICY" not in text


BUSINESSES = "wpa_businesses"
CONTACTS = "wpa_contacts"
NOTES = "wpa_contact_notes"
ACTIVITY = "wpa_activity"
TASKS = "wpa_tasks"


def _tag_match(row, tag):
    tags = row.get("tags")
    if tags is None:
        return False
    if isinstance(tags, str):
        return tag == tags or tag in [part.strip() for part in tags.split(",")]
    return tag in tags


class FakeQuery:
    """In-memory stand-in for a schema-scoped Supabase query. No network."""

    def __init__(self, client, table, rows):
        self.client = client
        self.table = table
        self.rows = [dict(row) for row in rows]
        self.selected = None
        self.ops = []
        self._limit = None
        self._order = None
        self._pending_insert = None
        self._pending_update = None

    def select(self, columns="*", *args, **kwargs):
        self.selected = columns
        self.ops.append(("select", columns))
        return self

    def eq(self, column, value):
        self.ops.append(("eq", column, value))
        return self

    def ilike(self, column, pattern):
        self.ops.append(("ilike", column, pattern))
        return self

    def gte(self, column, value):
        self.ops.append(("gte", column, value))
        return self

    def lte(self, column, value):
        self.ops.append(("lte", column, value))
        return self

    def contains(self, column, value):
        self.ops.append(("contains", column, value))
        return self

    def order(self, column, desc=False, **kwargs):
        self.ops.append(("order", column, desc))
        self._order = (column, desc)
        return self

    def limit(self, count):
        self.ops.append(("limit", count))
        self._limit = count
        return self

    def insert(self, row, *args, **kwargs):
        self._pending_insert = dict(row)
        self.ops.append(("insert", dict(row)))
        return self

    def update(self, values, *args, **kwargs):
        self._pending_update = dict(values)
        self.ops.append(("update", dict(values)))
        return self

    def delete(self, *args, **kwargs):
        raise AssertionError("write")

    def upsert(self, *args, **kwargs):
        raise AssertionError("write")

    def execute(self):
        self.client.calls.append(self)
        if self._pending_insert is not None:
            row = dict(self._pending_insert)
            if row.get("id") is None:
                row["id"] = self.client.next_id(self.table)
            self.client.tables.setdefault(self.table, []).append(row)
            return type("Result", (), {"data": [row]})()
        if self._pending_update is not None:
            rows = self._filtered(list(self.client.tables.get(self.table, [])))
            for row in rows:
                row.update(self._pending_update)
            return type("Result", (), {"data": [dict(row) for row in rows]})()
        rows = self._filtered(list(self.rows))
        if self._order:
            column, desc = self._order
            rows = sorted(rows, key=lambda row: row.get(column) or "", reverse=desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        if self.selected and self.selected != "*":
            cols = [part.strip() for part in self.selected.split(",") if part.strip()]
            rows = [{col: row.get(col) for col in cols} for row in rows]
        return type("Result", (), {"data": rows})()

    def _filtered(self, rows):
        kept = list(rows)
        for op in self.ops:
            kind = op[0]
            if kind == "eq":
                _, column, value = op
                kept = [row for row in kept if row.get(column) == value]
            elif kind == "ilike":
                _, column, pattern = op
                needle = str(pattern).strip("%").casefold()
                kept = [
                    row
                    for row in kept
                    if row.get(column) is not None and needle in str(row.get(column)).casefold()
                ]
            elif kind == "gte":
                _, column, value = op
                kept = [row for row in kept if (row.get(column) or "") >= value]
            elif kind == "lte":
                _, column, value = op
                kept = [row for row in kept if (row.get(column) or "") <= value]
            elif kind == "contains":
                _, column, value = op
                wanted = value[0] if isinstance(value, list) and value else value
                kept = [row for row in kept if _tag_match({"tags": row.get(column)}, wanted)]
        return kept


class FakeClient:
    def __init__(self, tables):
        self.tables = tables
        self.calls = []

    def table(self, name):
        return FakeQuery(self, name, self.tables.get(name, []))

    def next_id(self, table):
        rows = self.tables.get(table, [])
        if table in ("wpa_contacts", "wpa_contact_notes"):
            nums = [
                row.get("id")
                for row in rows
                if isinstance(row.get("id"), int) and not isinstance(row.get("id"), bool)
            ]
            return (max(nums) if nums else 0) + 1
        return f"new-{table}-{len(rows) + 1}"

    def rpc(self, name, params=None):
        return FakeRpc(self, name, params or {})


class FakeRpc:
    def __init__(self, client, name, params):
        self.client = client
        self.fn = name
        self.params = dict(params)
        self.table = name
        self.ops = [("rpc", name, dict(params))]
        self.selected = None

    def execute(self):
        self.client.calls.append(self)
        if self.fn != "append_activity":
            raise RuntimeError(f"unknown rpc {self.fn}")
        row = {
            "id": self.client.next_id("wpa_activity"),
            "business_id": self.params.get("p_business_id"),
            "type": self.params.get("p_type"),
            "summary": self.params.get("p_summary"),
            "occurred_at": self.params.get("p_occurred_at"),
            "actor": self.params.get("p_actor"),
        }
        self.client.tables.setdefault("wpa_activity", []).append(row)
        return type("Result", (), {"data": [row]})()


def _live_tables():
    businesses = []
    for row in BOOK.businesses:
        item = dict(row)
        item["raw_data"] = {"secret": "do-not-select"}
        businesses.append(item)
    contacts = [dict(row) for row in BOOK.contacts]
    notes = [dict(row) for row in BOOK.notes]
    activity = [
        {
            "id": "act-old",
            "business_id": "biz-pine",
            "summary": "Older call.",
            "actor": "chris",
            "occurred_at": "2026-01-01T00:00:00Z",
        },
        {
            "id": "act-1",
            "business_id": "biz-pine",
            "summary": "Called about greens.",
            "actor": "chris",
            "occurred_at": "2026-10-01T00:00:00Z",
            "raw_data": {"secret": "do-not-select"},
        },
    ]
    tasks = [dict(row) for row in BOOK.tasks]
    return {
        BUSINESSES: businesses,
        CONTACTS: contacts,
        NOTES: notes,
        ACTIVITY: activity,
        TASKS: tasks,
    }


def _live_reader():
    from mcp_crm.live import SupabaseCrmReader

    client = FakeClient(_live_tables())
    return SupabaseCrmReader(client), client


def test_live_reader_queries_needed_rows_with_a_fake_client():
    reader, client = _live_reader()

    found = reader.search("Valley")
    assert found["id"] == "biz-pine"
    assert isinstance(found["id"], str)
    assert found["message"] == "Found Pine Valley"
    assert "raw_data" not in json.dumps(found)
    business_ilike = [
        op[1]
        for call in client.calls
        if call.table == BUSINESSES
        for op in call.ops
        if op[0] == "ilike"
    ]
    contact_ilike = [
        op[1]
        for call in client.calls
        if call.table == CONTACTS
        for op in call.ops
        if op[0] == "ilike"
    ]
    assert set(business_ilike) == {"name", "phone"}
    assert set(contact_ilike) == {"name", "last_name", "email", "phone"}
    assert all(call.selected and "raw_data" not in call.selected for call in client.calls)

    by_email = reader.search("ada@pine.example", type="contact")
    assert by_email["id"] == 10
    assert isinstance(by_email["id"], int)
    assert by_email["message"] == "Found Ada Lovelace"

    missed = reader.search("Ada", type="business")
    assert missed["businesses"] == []
    assert missed["contacts"] == []
    assert missed["message"] == "No matches"

    client.calls.clear()
    business = reader.get_business("biz-pine")
    assert business["id"] == "biz-pine"
    assert isinstance(business["id"], str)
    assert business["message"] == "Pine Valley"
    assert business["business"]["name"] == "Pine Valley"
    assert "raw_data" not in business["business"]
    assert [row["id"] for row in business["contacts"]] == [10]
    assert isinstance(business["contacts"][0]["id"], int)
    assert [row["id"] for row in business["activity"]] == ["act-1", "act-old"]
    assert [row["id"] for row in business["tasks"]] == ["task-1"]
    queried = {call.table for call in client.calls}
    assert queried == {BUSINESSES, CONTACTS, ACTIVITY, TASKS}
    assert NOTES not in queried
    business_selects = [call.selected for call in client.calls if call.table == BUSINESSES]
    assert business_selects
    assert all(select and "raw_data" not in select and select != "*" for select in business_selects)
    activity_ops = next(call.ops for call in client.calls if call.table == ACTIVITY)
    assert ("eq", "business_id", "biz-pine") in activity_ops
    assert ("order", "occurred_at", True) in activity_ops

    missing = reader.get_business("missing")
    assert missing["id"] == "missing"
    assert missing["message"] == "Business not found"
    assert missing["business"] is None
    assert missing["contacts"] == []
    assert missing["activity"] == []
    assert missing["tasks"] == []

    client.calls.clear()
    contact = reader.get_contact(10)
    assert contact["id"] == 10
    assert isinstance(contact["id"], int)
    assert contact["message"] == "Ada Lovelace"
    assert any("clubhouse" in row["body"] for row in contact["notes"])
    assert {call.table for call in client.calls} == {CONTACTS, NOTES}
    assert all(call.table != ACTIVITY for call in client.calls)

    leads = reader.list_businesses(stage="lead")
    assert leads["id"] == "biz-oak"
    assert leads["message"] == "1 business"
    assert [row["id"] for row in leads["businesses"]] == ["biz-oak"]
    lead_ops = next(call.ops for call in client.calls if call.table == BUSINESSES and ("eq", "lifecycle_stage", "lead") in call.ops)
    assert ("limit", 25) in lead_ops
    assert not any(op[0] == "eq" and op[1] != "lifecycle_stage" for op in lead_ops)

    people = reader.list_contacts(business_id="biz-pine")
    assert people["id"] == 10
    assert isinstance(people["id"], int)
    assert people["message"] == "1 contact"
    assert [row["id"] for row in people["contacts"]] == [10]

    client.calls.clear()
    tasks = reader.list_tasks(tag="greens", assigned_to=SUBJECT, status="open")
    assert tasks["id"] == "task-1"
    assert tasks["message"] == "1 task"
    assert [row["id"] for row in tasks["tasks"]] == ["task-1"]
    task_ops = client.calls[-1].ops
    assert ("eq", "status", "open") in task_ops
    assert ("eq", "assigned_to", SUBJECT) in task_ops
    assert ("contains", "tags", ["greens"]) in task_ops
    assert ("limit", 25) in task_ops

    client.calls.clear()
    due = reader.list_tasks(due_from="2026-11-01", due_to="2026-11-01")
    assert [row["id"] for row in due["tasks"]] == ["task-1"]
    due_ops = client.calls[-1].ops
    assert ("gte", "due_date", "2026-11-01") in due_ops
    assert ("lte", "due_date", "2026-11-01") in due_ops

    client.calls.clear()
    activity = reader.list_activity("biz-pine")
    assert activity["id"] == "act-1"
    assert activity["message"] == "2 activities"
    assert [row["id"] for row in activity["activity"]] == ["act-1", "act-old"]
    assert "raw_data" not in json.dumps(activity)
    activity_call = client.calls[-1]
    assert activity_call.table == ACTIVITY
    assert ("eq", "business_id", "biz-pine") in activity_call.ops
    assert ("order", "occurred_at", True) in activity_call.ops
    assert all(op[0] != "insert" for call in client.calls for op in call.ops)


def test_live_reader_limit_defaults_to_25_and_caps_at_50():
    from mcp_crm.live import SupabaseCrmReader

    businesses = [
        {
            "id": f"biz-{index}",
            "name": f"Course {index}",
            "phone": f"555-{index:04d}",
            "website_url": None,
            "lifecycle_stage": "identified",
        }
        for index in range(60)
    ]
    client = FakeClient({BUSINESSES: businesses, CONTACTS: [], NOTES: [], ACTIVITY: [], TASKS: []})
    reader = SupabaseCrmReader(client)
    defaulted = reader.list_businesses()
    capped = reader.list_businesses(limit=100)
    assert len(defaulted["businesses"]) == 25
    assert defaulted["id"] == "biz-0"
    assert defaulted["message"] == "25 businesses"
    assert len(capped["businesses"]) == 50
    assert capped["message"] == "50 businesses"
    limits = [op[1] for call in client.calls if call.table == BUSINESSES for op in call.ops if op[0] == "limit"]
    assert limits == [25, 50]


def test_health_is_public_and_ok():
    app = _app(MemoryTokenStore())
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_requirements_keep_mcp_and_add_live_runtime():
    text = (ROOT / "mcp_crm" / "requirements.txt").read_text()
    assert "mcp==2.3.0" in text
    assert "supabase" in text
    assert "uvicorn" in text


def test_dockerfile_starts_the_mcp_process():
    text = (ROOT / "mcp_crm" / "Dockerfile").read_text()
    assert "python:3.12-slim" in text
    assert "requirements.txt" in text
    normalized = text.replace('", "', " ")
    assert "python -m mcp_crm" in normalized


def _patch_process(monkeypatch, port=None, token=None, user_id=None):
    import mcp_crm.__main__ as entry

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test")
    if port is None:
        monkeypatch.delenv("MCP_PORT", raising=False)
    else:
        monkeypatch.setenv("MCP_PORT", port)
    if token is None:
        monkeypatch.delenv("MCP_API_TOKEN", raising=False)
    else:
        monkeypatch.setenv("MCP_API_TOKEN", token)
    if user_id is None:
        monkeypatch.delenv("MCP_USER_ID", raising=False)
    else:
        monkeypatch.setenv("MCP_USER_ID", user_id)
    monkeypatch.delenv("MCP_PUBLIC_URL", raising=False)

    client = object()
    monkeypatch.setattr(entry, "wpa_client", lambda: client)
    ran = {}
    built = {}

    def fake_run(app, host, port):
        ran["app"] = app
        ran["host"] = host
        ran["port"] = port

    class FakeUvicorn:
        run = staticmethod(fake_run)

    monkeypatch.setattr(entry, "uvicorn", FakeUvicorn, raising=False)
    real_build = entry.build_app

    def spy(store, reader, **kwargs):
        built["store"] = store
        built["reader"] = reader
        built["kwargs"] = kwargs
        return real_build(store, reader, **kwargs)

    monkeypatch.setattr(entry, "build_app", spy)
    return entry, client, ran, built


def test_process_entry_starts_uvicorn(monkeypatch, capsys):
    from mcp_crm.live import SupabaseCrmReader

    entry, client, ran, built = _patch_process(monkeypatch)
    assert entry.main() == 0
    assert ran["host"] == "0.0.0.0"
    assert ran["port"] == 8000
    assert built["kwargs"]["public_url"] == "https://whitepine-tech.com/crm/mcp"
    assert isinstance(built["reader"], SupabaseCrmReader)
    assert built["reader"].client is client
    assert "not live" not in capsys.readouterr().err
    with TestClient(ran["app"]) as http:
        health = http.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}


def test_process_port_comes_from_env(monkeypatch):
    entry, _client, ran, _built = _patch_process(monkeypatch, port="9001")
    assert entry.main() == 0
    assert ran["port"] == 9001


def test_process_exits_when_only_one_static_token_env_is_set(monkeypatch):
    entry, _client, ran, _built = _patch_process(monkeypatch, token="crm_only")
    with pytest.raises(SystemExit):
        entry.main()
    assert "app" not in ran
    entry, _client, ran, _built = _patch_process(monkeypatch, user_id="user-text")
    with pytest.raises(SystemExit):
        entry.main()
    assert "app" not in ran


def test_e164_search_finds_parenthesized_phone():
    book = _phone_book()
    reader = CrmReader(book)
    for query in ("+12089380025", "208-938-0025", "(208) 938-0025"):
        found = reader.search(query)
        assert [row["id"] for row in found["contacts"]] == [42]
        assert found["businesses"] == []
    missed = reader.search("+12089380026")
    assert missed["contacts"] == []
    assert missed["businesses"] == []
    named = reader.search("Pat")
    assert [row["id"] for row in named["contacts"]] == [42]


def _phone_book():
    return Book(
        businesses=[
            {
                "id": "biz-dog",
                "name": "Dog Zen",
                "phone": "",
                "lifecycle_stage": "lead",
            }
        ],
        contacts=[
            {
                "id": 42,
                "business_id": "biz-dog",
                "name": "Pat",
                "last_name": "Zen",
                "email": "pat@dog.example",
                "phone": "(208) 938-0025",
                "notes": "keep me",
            }
        ],
        notes=[],
        activity=[],
        tasks=[],
    )


def test_process_accepts_static_token_when_both_envs_are_text(monkeypatch):
    entry, _client, ran, built = _patch_process(monkeypatch, token="crm_static", user_id="user-text")
    assert entry.main() == 0
    assert ran["port"] == 8000
    store = built["store"]
    assert type(store).__name__ == "FallbackTokenStore"
    static = store.stores[-1]
    assert type(static).__name__ == "StaticTokenStore"
    assert static.record.user_id == "user-text"
    assert isinstance(static.record.user_id, str)
    accepted = store.verify("crm_static")
    assert accepted is not None
    assert accepted.user_id == "user-text"
    assert isinstance(accepted.user_id, str)


NANCY_FIELDS = {"id", "first_name", "lifecycle_stage", "business_name"}


def _fresh_book():
    return Book(
        businesses=copy.deepcopy(BOOK.businesses),
        contacts=copy.deepcopy(BOOK.contacts),
        notes=copy.deepcopy(BOOK.notes),
        activity=copy.deepcopy(BOOK.activity),
        tasks=copy.deepcopy(BOOK.tasks),
    )


def _tokens(*labels, book=None):
    store = MemoryTokenStore()
    raw = {}
    chosen = book if book is not None else _fresh_book()
    for label in labels:
        token, _record = store.mint(SUBJECT, label)
        raw[label] = token

    def app():
        return build_app(store, CrmReader(chosen), public_url=PUBLIC_URL)

    return app, raw


def test_create_contact_uses_a_business_phone_without_changing_stage():
    book = _phone_book()
    book.businesses[0]["phone"] = "(208) 938-0025"
    book.businesses[0]["lifecycle_stage"] = "client"
    book.contacts[0]["is_primary"] = True
    book.contacts[0]["phone"] = "208-555-0199"
    reader = CrmReader(book)
    found = reader.create_contact(phone="+12089380025", first_name="Other", notes="skip")
    assert found["created"] is False
    assert found["contact"]["id"] == 42
    assert found["contact"]["name"] == "Pat"
    assert book.businesses[0]["lifecycle_stage"] == "client"
    assert book.notes == []
    book.contacts[0]["is_primary"] = False
    created = reader.create_contact(phone="+12089380025", first_name="Nia", last_name="Cole")
    assert created["created"] is True
    assert created["contact"]["business_id"] == "biz-dog"
    assert created["contact"]["phone"] == "+12089380025"
    assert "notes" not in created["contact"]
    assert book.businesses[0]["lifecycle_stage"] == "client"
    assert len(book.contacts) == 2


def test_phone_search_matches_business_phone_and_not_a_different_number():
    book = _phone_book()
    book.businesses[0]["phone"] = "(208) 555-0199"
    book.contacts[0]["phone"] = ""
    found = CrmReader(book).search("+12085550199")
    assert [row["id"] for row in found["businesses"]] == ["biz-dog"]
    assert found["contacts"] == []
    assert CrmReader(book).search("+12085550198")["businesses"] == []


def test_nancy_payload_has_four_fields_and_cannot_read_the_card():
    book = _phone_book()
    app, raw = _tokens("nancy", "grok", book=book)
    with McpSession(app(), raw["nancy"]) as nancy:
        found = nancy.call("search", {"query": "+12089380025"})
        assert set(found) == NANCY_FIELDS
        assert found["id"] == 42
        assert isinstance(found["id"], int)
        assert found["first_name"] == "Pat"
        assert found["lifecycle_stage"] == "lead"
        assert found["business_name"] == "Dog Zen"
        dumped = json.dumps(found)
        assert "938-0025" not in dumped
        assert "pat@dog.example" not in dumped
        assert "keep me" not in dumped
        looked = nancy.call("find_contact_by_phone", {"phone": "208-938-0025"})
        assert set(looked) == NANCY_FIELDS
        assert looked["id"] == 42
        blocked = nancy.call("get_business", {"id": "biz-dog"})
        assert blocked["message"] == "Nancy cannot call get_business"
        assert "service_tier" not in blocked
        assert "monthly_revenue" not in blocked
        other = nancy.call("search", {"query": "+12089380026"})
        assert set(other) == NANCY_FIELDS
        assert other["id"] is None


def test_buddy_search_keeps_current_fields_and_get_business_includes_service_tier():
    book = _fresh_book()
    book.contracts = [
        {
            "business_id": "biz-pine",
            "status": "ended",
            "service_tier": "old",
            "monthly_revenue": 1,
            "start_date": "2026-08-01",
            "current_phase": "done",
            "next_action": "none",
            "notes": "ended notes",
            "folder_path": "/old",
        },
        {
            "business_id": "biz-pine",
            "status": "active",
            "service_tier": "starter",
            "monthly_revenue": 900,
            "start_date": "2026-01-01",
            "current_phase": "early",
            "next_action": "wait",
            "notes": "older active",
            "folder_path": "/early",
        },
        {
            "business_id": "biz-pine",
            "status": "active",
            "service_tier": "growth",
            "monthly_revenue": 1500,
            "start_date": "2026-06-01",
            "current_phase": "onboarding",
            "next_action": "call",
            "notes": "client notes",
            "folder_path": "/files/pine",
        },
    ]
    app, raw = _tokens("grok", "nancy", book=book)
    with McpSession(app(), raw["grok"]) as buddy:
        found = buddy.call("search", {"query": "ada@pine.example"})
        assert found["contacts"][0]["email"] == "ada@pine.example"
        assert "businesses" in found
        assert "message" in found
        card = buddy.call("get_business", {"id": "biz-pine"})
        assert card["service_tier"] == "growth"
        assert card["monthly_revenue"] == 1500
        assert card["status"] == "active"
        assert card["start_date"] == "2026-06-01"
        assert card["current_phase"] == "onboarding"
        assert card["next_action"] == "call"
        assert card["notes"] == "client notes"
        assert card["folder_path"] == "/files/pine"
        assert card["business"]["lifecycle_stage"] == "client"
        empty = buddy.call("get_business", {"id": "biz-oak"})
        assert empty["service_tier"] is None
        assert empty["monthly_revenue"] is None
        assert empty["status"] is None
    with McpSession(app(), raw["nancy"]) as nancy:
        blocked = nancy.call("get_business", {"id": "biz-pine"})
        assert "growth" not in json.dumps(blocked)
        assert blocked["message"] == "Nancy cannot call get_business"


def test_create_contact_matches_ten_digits_and_does_not_invent_a_business():
    book = _phone_book()
    book.businesses[0]["lifecycle_stage"] = "client"
    app, raw = _tokens("nancy", "grok", book=book)
    with McpSession(app(), raw["nancy"]) as nancy:
        again = nancy.call("create_contact", {
            "phone": "+12089380025",
            "first_name": "Other",
            "business_name": "Other Co",
            "notes": "do not write",
            "source": "phone",
        })
        assert set(again) == NANCY_FIELDS
        assert again["id"] == 42
        assert again["first_name"] == "Pat"
        assert book.contacts[0]["name"] == "Pat"
        assert book.contacts[0]["notes"] == "keep me"
        assert book.businesses[0]["lifecycle_stage"] == "client"
        assert len(book.contacts) == 1
        assert book.notes == []
        missing = nancy.call("create_contact", {"phone": "+12085550000", "first_name": "Pat"})
        assert missing["message"] == "A new number needs a business_name"
        assert "Error executing tool" not in missing["message"]
        assert len(book.businesses) == 1
        assert len(book.contacts) == 1
        bad = nancy.call("create_contact", {
            "phone": "12345",
            "first_name": "Pat",
            "business_name": "New Co",
        })
        assert bad["message"] == "Phone must be +1 and ten digits"
        assert "Error executing tool" not in bad["message"]
        assert len(book.contacts) == 1
    with McpSession(app(), raw["grok"]) as buddy:
        created = buddy.call("create_contact", {
            "phone": "(208) 555-0101",
            "first_name": "Nia",
            "last_name": "Cole",
            "business_name": "New Co",
            "source": "phone",
            "notes": "Called in",
        })
        assert created["created"] is True
        assert created["contact"]["name"] == "Nia"
        assert created["contact"]["last_name"] == "Cole"
        assert created["contact"]["phone"] == "+12085550101"
        assert "notes" not in created["contact"]
        business = next(row for row in book.businesses if row["name"] == "New Co")
        assert business["lifecycle_stage"] == "lead"
        assert business["lead_source"] == "phone"
        assert created["contact"]["business_id"] == business["id"]
        assert book.notes[-1]["body"] == "Called in"
        assert book.notes[-1]["type"] == "note"
        assert "actor" not in book.notes[-1]
        book.businesses.append({
            "id": "biz-pine",
            "name": "Pine Valley",
            "phone": "",
            "lifecycle_stage": "client",
        })
        partial = buddy.call("create_contact", {
            "phone": "+12085550002",
            "first_name": "Ada",
            "business_name": "Pine",
        })
        assert partial["contact"]["business_id"] != "biz-pine"
        attached = buddy.call("create_contact", {
            "phone": "+12085550003",
            "first_name": "Bea",
            "business_name": "pine valley",
        })
        assert attached["contact"]["business_id"] == "biz-pine"
        pine = next(row for row in book.businesses if row["id"] == "biz-pine")
        assert pine["lifecycle_stage"] == "client"


def test_note_append_does_not_change_contact_notes_and_rejects_overlong_text():
    book = _phone_book()
    app, raw = _tokens("nancy", book=book)
    with McpSession(app(), raw["nancy"]) as nancy:
        added = nancy.call("add_contact_note", {"contact_id": 42, "body": "Left a voicemail"})
        assert added["note"]["type"] == "note"
        assert added["note"]["body"] == "Left a voicemail"
        assert "actor" not in added["note"]
        assert book.contacts[0]["notes"] == "keep me"
        too_long = nancy.call("add_contact_note", {"contact_id": 42, "body": "x" * 2001})
        assert "over 2000" in too_long["message"]
        assert "Error executing tool" not in too_long["message"]
        assert len(book.notes) == 1
        assert book.contacts[0]["notes"] == "keep me"


def test_log_activity_and_create_task_resolve_the_business():
    book = _fresh_book()
    before = len(book.activity)
    app, raw = _tokens("nancy", "grok", book=book)
    with McpSession(app(), raw["nancy"]) as nancy:
        logged = nancy.call("log_activity", {
            "contact_id": 10,
            "type": "inbound_call",
            "summary": "Asked about greens",
        })
        assert logged["activity"]["business_id"] == "biz-pine"
        assert logged["activity"]["actor"] == "nancy"
        assert logged["activity"]["type"] == "inbound_call"
        mismatch = nancy.call("log_activity", {
            "contact_id": 10,
            "business_id": "biz-oak",
            "type": "inbound_call",
            "summary": "wrong business",
        })
        assert "do not match" in mismatch["message"]
        assert len(book.activity) == before + 1
        task = nancy.call("create_task", {"contact_id": 10, "title": "Call back", "due_date": "2026-11-02"})
        assert task["task"]["business_id"] == "biz-pine"
        assert task["task"]["status"] == "todo"
        assert task["task"]["assigned_to"] == "human"
        assert task["task"]["tags"] == ["nancy"]
        assert "notes" not in task["task"]
        long_title = nancy.call("create_task", {"business_id": "biz-pine", "title": "y" * 2001})
        assert "over 2000" in long_title["message"]
        assert all(row.get("title") != "y" * 2001 for row in book.tasks)
    with McpSession(app(), raw["grok"]) as buddy:
        logged = buddy.call("log_activity", {
            "business_id": "biz-oak",
            "type": "inbound_call",
            "summary": "Buddy called",
        })
        assert logged["activity"]["actor"] == "buddy"
        task = buddy.call("create_task", {"business_id": "biz-oak", "title": "Buddy task"})
        assert task["task"]["tags"] == ["grok"]
        assert task["task"]["assigned_to"] == "human"


def test_update_contact_is_buddy_only_and_rejects_other_fields():
    book = _fresh_book()
    book.contacts[0]["role"] = "Member"
    app, raw = _tokens("nancy", "grok", book=book)
    with McpSession(app(), raw["nancy"]) as nancy:
        blocked = nancy.call("update_contact", {"id": 10, "role": "Owner"})
        assert blocked["message"] == "Only Buddy can update a contact"
        assert book.contacts[0]["role"] == "Member"
    with McpSession(app(), raw["grok"]) as buddy:
        rejected = buddy.call("update_contact", {"id": 10, "phone": "+12089380025", "role": "Owner"})
        assert "Cannot update phone" in rejected["message"]
        assert book.contacts[0]["role"] == "Member"
        changed = buddy.call("update_contact", {"id": 10, "role": "Owner"})
        assert changed["contact"]["role"] == "Owner"
        assert book.contacts[0]["role"] == "Owner"


def test_database_error_returns_its_message(caplog):
    class BoomReader(CrmReader):
        def create_contact(self, *args, **kwargs):
            raise RuntimeError("duplicate key value violates unique constraint")

    store = MemoryTokenStore()
    raw, _record = store.mint(SUBJECT, "grok")
    app = build_app(store, BoomReader(_fresh_book()), public_url=PUBLIC_URL)
    caplog.set_level(logging.INFO, logger="mcp_crm")
    with McpSession(app, raw) as buddy:
        failed = buddy.call("create_contact", {
            "phone": "+12085550111",
            "first_name": "Nia",
            "business_name": "New Co",
        })
    assert failed["message"] == "duplicate key value violates unique constraint"
    assert "Error executing tool" not in failed["message"]
    assert raw not in caplog.text


def test_note_log_records_label_and_row_id_not_body_or_bearer(caplog):
    book = _phone_book()
    app, raw = _tokens("nancy", book=book)
    caplog.set_level(logging.INFO, logger="mcp_crm")
    with McpSession(app(), raw["nancy"]) as nancy:
        nancy.call("add_contact_note", {"contact_id": 42, "body": "secret note text"})
    assert "secret note text" not in caplog.text
    assert raw["nancy"] not in caplog.text
    assert "tool=add_contact_note" in caplog.text
    assert "label=nancy" in caplog.text
    assert "row_id=42" in caplog.text
    assert " at=" in caplog.text


def test_live_search_matches_digits_and_note_append_does_not_change_contact_notes():
    from mcp_crm.live import NOTES, SupabaseCrmReader

    tables = _live_tables()
    tables[CONTACTS][0]["phone"] = "(208) 938-0025"
    tables[CONTACTS][0]["notes"] = "keep me"
    client = FakeClient(tables)
    reader = SupabaseCrmReader(client)
    found = reader.search("+12089380025")
    assert [row["id"] for row in found["contacts"]] == [10]
    ilike_patterns = [op[2] for call in client.calls for op in call.ops if op[0] == "ilike"]
    assert not any("+12089380025" in str(pattern) for pattern in ilike_patterns)
    client.calls.clear()
    missed = reader.search("+12089380026")
    assert missed["contacts"] == []
    client.calls.clear()
    added = reader.add_contact_note(10, "new note")
    assert tables[CONTACTS][0]["notes"] == "keep me"
    assert not any(op[0] == "update" for call in client.calls for op in call.ops)
    inserts = [call for call in client.calls if any(op[0] == "insert" for op in call.ops)]
    assert len(inserts) == 1
    assert inserts[0].table == NOTES
    payload = next(op[1] for op in inserts[0].ops if op[0] == "insert")
    assert payload["type"] == "note"
    assert payload["body"] == "new note"
    assert "actor" not in payload
    assert "label" not in payload
    assert added["note"]["contact_id"] == 10
    client.calls.clear()
    rejected = None
    try:
        reader.add_contact_note(10, "z" * 2001)
    except ValueError as exc:
        rejected = str(exc)
    assert rejected and "over 2000" in rejected
    assert tables[CONTACTS][0]["notes"] == "keep me"
    assert not any(op[0] == "insert" for call in client.calls for op in call.ops)


def test_live_writes_use_rpc_and_do_not_write_task_or_contact_notes():
    from mcp_crm.live import ACTIVITY, TASKS, SupabaseCrmReader

    tables = _live_tables()
    tables[CONTACTS][0]["notes"] = "keep me"
    tables[CONTACTS][0]["role"] = "Member"
    client = FakeClient(tables)
    reader = SupabaseCrmReader(client)
    logged = reader.log_activity("inbound_call", "Called", "buddy", contact_id=10)
    assert logged["activity"]["business_id"] == "biz-pine"
    assert logged["activity"]["actor"] == "buddy"
    rpc = next(call for call in client.calls if getattr(call, "fn", None) == "append_activity")
    assert rpc.params["p_business_id"] == "biz-pine"
    assert rpc.params["p_actor"] == "buddy"
    assert rpc.params["p_type"] == "inbound_call"
    assert "summary" not in rpc.params
    assert any(getattr(call, "fn", None) == "append_activity" for call in client.calls)
    assert not any(
        call.table == ACTIVITY and any(op[0] == "insert" for op in getattr(call, "ops", []))
        for call in client.calls
    )
    client.calls.clear()
    task = reader.create_task("Follow up", "grok", business_id="biz-oak")
    assert task["task"]["status"] == "todo"
    assert task["task"]["assigned_to"] == "human"
    assert task["task"]["tags"] == ["grok"]
    assert task["task"]["business_id"] == "biz-oak"
    insert = next(call for call in client.calls if any(op[0] == "insert" for op in call.ops))
    assert insert.table == TASKS
    payload = next(op[1] for op in insert.ops if op[0] == "insert")
    assert "notes" not in payload
    client.calls.clear()
    try:
        reader.update_contact(10, {"phone": "+12089380025"})
    except ValueError as exc:
        assert "Cannot update phone" in str(exc)
    else:
        raise AssertionError("phone update should fail")
    assert not any(op[0] == "update" for call in client.calls for op in call.ops)
    assert tables[CONTACTS][0]["notes"] == "keep me"
    reader.update_contact(10, {"role": "Owner"})
    assert tables[CONTACTS][0]["role"] == "Owner"
    assert tables[CONTACTS][0]["notes"] == "keep me"


def test_live_active_contract_is_latest_active_row():
    from mcp_crm.live import SupabaseCrmReader

    tables = _live_tables()
    tables["wpa_contracts"] = [
        {
            "business_id": "biz-pine",
            "status": "active",
            "service_tier": "starter",
            "monthly_revenue": 900,
            "start_date": "2026-01-01",
            "current_phase": "early",
            "next_action": "wait",
            "notes": "older",
            "folder_path": "/early",
        },
        {
            "business_id": "biz-pine",
            "status": "active",
            "service_tier": "growth",
            "monthly_revenue": 1500,
            "start_date": "2026-06-01",
            "current_phase": "onboarding",
            "next_action": "call",
            "notes": "current",
            "folder_path": "/files/pine",
        },
        {
            "business_id": "biz-pine",
            "status": "ended",
            "service_tier": "old",
            "monthly_revenue": 1,
            "start_date": "2026-09-01",
            "current_phase": "done",
            "next_action": "none",
            "notes": "ended",
            "folder_path": "/old",
        },
    ]
    reader = SupabaseCrmReader(FakeClient(tables))
    contract = reader.active_contract("biz-pine")
    assert contract is not None
    assert contract["service_tier"] == "growth"
    assert contract["monthly_revenue"] == 1500
    assert reader.active_contract("biz-oak") is None


def test_phone_e164_migration_file_exists_and_is_not_applied():
    path = ROOT / "supabase" / "migrations" / "20261028120000_phone_e164.sql"
    text = path.read_text()
    assert "wpa.wpa_businesses" in text
    assert "wpa.wpa_contacts" in text
    assert "phone IS NULL OR phone = '' OR phone ~ '^\\+1[0-9]{10}$'" in text
    assert "RAISE EXCEPTION" in text
    assert "updated_at = now()" in text
    assert "UPDATE public" not in text
    assert "public.wpa_businesses" not in text
    assert "supabase db push" not in text.lower() or "do not" in text.lower()


def test_normalize_returns_null_for_nonempty_phone_that_is_not_ten_digits():
    path = ROOT / "supabase" / "migrations" / "20261028120000_phone_e164.sql"
    text = path.read_text()
    start = text.index("FUNCTION wpa._phone_e164_normalize")
    end = text.index("DROP FUNCTION wpa._phone_e164_normalize", start)
    body = text[start:end]
    after_digits = body.split("regexp_replace", 1)[1]
    assert "btrim(raw) = ''" in body
    assert "wpa._phone_e164_normalize(phone) IS NULL" in text
    assert "RETURN '';" not in after_digits
    assert "RETURN NULL;" in after_digits


def test_to_e164_rejects_nonempty_text_with_no_digits():
    assert to_e164("abc") is None
    assert to_e164("n/a") is None
    assert to_e164("TBD") is None
    assert to_e164("   ") == ""
    assert to_e164(None) == ""
    assert to_e164("") == ""
    assert to_e164("(208) 938-0025") == "+12089380025"

