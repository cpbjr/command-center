"""Read-only CRM MCP. Fake book only. No live Supabase."""
import json
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from mcp_crm.reader import Book, CrmReader
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
    if isinstance(structured, dict) and "message" in structured:
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
        assert names == READ_TOOLS
        for name in names:
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
    assert names == READ_TOOLS


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

    def insert(self, *args, **kwargs):
        raise AssertionError("write")

    def update(self, *args, **kwargs):
        raise AssertionError("write")

    def delete(self, *args, **kwargs):
        raise AssertionError("write")

    def upsert(self, *args, **kwargs):
        raise AssertionError("write")

    def execute(self):
        self.client.calls.append(self)
        rows = list(self.rows)
        for op in self.ops:
            kind = op[0]
            if kind == "eq":
                _, column, value = op
                rows = [row for row in rows if row.get(column) == value]
            elif kind == "ilike":
                _, column, pattern = op
                needle = str(pattern).strip("%").casefold()
                rows = [
                    row
                    for row in rows
                    if row.get(column) is not None and needle in str(row.get(column)).casefold()
                ]
            elif kind == "gte":
                _, column, value = op
                rows = [row for row in rows if (row.get(column) or "") >= value]
            elif kind == "lte":
                _, column, value = op
                rows = [row for row in rows if (row.get(column) or "") <= value]
            elif kind == "contains":
                _, column, value = op
                wanted = value[0] if isinstance(value, list) and value else value
                rows = [row for row in rows if _tag_match({"tags": row.get(column)}, wanted)]
        if self._order:
            column, desc = self._order
            rows = sorted(rows, key=lambda row: row.get(column) or "", reverse=desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        if self.selected and self.selected != "*":
            cols = [part.strip() for part in self.selected.split(",") if part.strip()]
            rows = [{col: row.get(col) for col in cols} for row in rows]
        return type("Result", (), {"data": rows})()


class FakeClient:
    def __init__(self, tables):
        self.tables = tables
        self.calls = []

    def table(self, name):
        return FakeQuery(self, name, self.tables.get(name, []))


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
