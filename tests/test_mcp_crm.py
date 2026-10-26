"""Read-only CRM MCP. Fake book only. No live Supabase."""
import json
from pathlib import Path

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
