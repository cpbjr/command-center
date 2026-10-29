"""Streamable HTTP MCP server for Command Center CRM."""
import logging
from datetime import datetime, timezone

from mcp.server.auth.provider import AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import AnyHttpUrl
from starlette.responses import JSONResponse
from starlette.routing import Route

from mcp_crm.reader import CONTRACT_FIELDS
from mcp_crm.tokens import hash_token


logger = logging.getLogger("mcp_crm")

READ_SCOPE = "crm:read"
PUBLIC_PATH = "/crm/mcp"
NANCY_LABEL = "nancy"
BUDDY_LABEL = "grok"
NANCY_TOOLS = frozenset({
    "find_contact_by_phone",
    "search",
    "create_contact",
    "add_contact_note",
    "log_activity",
    "create_task",
})
NANCY_SHAPED = frozenset({"find_contact_by_phone", "search", "create_contact"})
WRITE_TOOLS = frozenset({
    "create_contact",
    "add_contact_note",
    "log_activity",
    "create_task",
    "update_contact",
})
NANCY_KEYS = ("id", "first_name", "lifecycle_stage", "business_name")


class CrmTokenVerifier:
    def __init__(self, store, resource_url: str):
        self.store = store
        self.resource_url = resource_url

    async def verify_token(self, token: str) -> AccessToken | None:
        record = self.store.verify(token)
        if record is None:
            logger.info("mcp auth rejected")
            return None
        logger.info("mcp auth ok subject=%s token=%s", record.user_id, record.token_id)
        return AccessToken(
            token=hash_token(token),
            client_id=record.token_id,
            scopes=[READ_SCOPE],
            resource=self.resource_url,
            subject=record.user_id,
            claims={"label": record.label or ""},
        )


def _token() -> AccessToken:
    from mcp.server.auth.middleware.auth_context import get_access_token

    token = get_access_token()
    if token is None or not token.subject:
        raise PermissionError("Missing subject")
    return token


def _label() -> str:
    return str((_token().claims or {}).get("label") or "")


def _log_call(name: str, label: str, row_id) -> None:
    logger.info(
        "mcp call tool=%s label=%s row_id=%s at=%s",
        name,
        label,
        "" if row_id is None else row_id,
        datetime.now(timezone.utc).isoformat(),
    )


def _deny(name: str, label: str) -> str | None:
    if label == NANCY_LABEL and name not in NANCY_TOOLS:
        if name == "update_contact":
            return "Only Buddy can update a contact"
        return f"Nancy cannot call {name}"
    if name == "update_contact" and label != BUDDY_LABEL:
        return "Only Buddy can update a contact"
    if name in WRITE_TOOLS and label not in (NANCY_LABEL, BUDDY_LABEL):
        return f"This token cannot call {name}"
    return None


def _actor(label: str) -> str:
    if label == BUDDY_LABEL:
        return "buddy"
    if label == NANCY_LABEL:
        return "nancy"
    return label


def _nancy_payload(reader, result: dict) -> dict:
    contact = result.get("contact")
    if contact is None:
        contacts = result.get("contacts") or []
        contact = contacts[0] if contacts else None
    if contact is None:
        businesses = result.get("businesses") or []
        if businesses:
            business_id = businesses[0].get("id")
            contact = reader.primary_contact(business_id)
            if contact is None:
                people = reader.list_contacts(business_id, limit=1).get("contacts") or []
                contact = people[0] if people else {"id": None, "name": None, "business_id": business_id}
    if not contact:
        return {key: None for key in NANCY_KEYS}
    card = reader.business_card(contact.get("business_id"))
    return {
        "id": contact.get("id"),
        "first_name": contact.get("name"),
        "lifecycle_stage": card.get("lifecycle_stage"),
        "business_name": card.get("name"),
    }


def _buddy_business(reader, result: dict) -> dict:
    shaped = dict(result)
    contract = reader.active_contract(shaped.get("id")) or {}
    for key in CONTRACT_FIELDS:
        shaped[key] = contract.get(key)
    return shaped


def _call(reader, name: str, fn, row_id: str | int = ""):
    label = ""
    try:
        label = _label()
        denied = _deny(name, label)
        if denied:
            _log_call(name, label, row_id)
            return {"id": row_id, "message": denied}
        result = fn()
    except Exception as exc:
        _log_call(name, label, row_id)
        return {"id": row_id, "message": str(exc)}
    result_id = result.get("id", row_id) if isinstance(result, dict) else row_id
    logged_id = row_id if row_id not in ("", None) else result_id
    _log_call(name, label, logged_id)
    if not isinstance(result, dict):
        return result
    if label == NANCY_LABEL and name in NANCY_SHAPED:
        return _nancy_payload(reader, result)
    if label == BUDDY_LABEL and name == "get_business":
        return _buddy_business(reader, result)
    return result


def build_server(store, reader, *, public_url: str) -> MCPServer:
    server = MCPServer(
        name="command-center-crm",
        title="Command Center CRM",
        instructions=(
            "Tools for the Command Center book. "
            "A business id is text. A contact id is a number. "
            "Phones are stored as +1 and ten digits. "
            "list limits default to 25 and cap at 50. "
            "Do not convert a client, move a stage, or end an engagement. "
            "Every Buddy result includes an id and a message."
        ),
        auth=AuthSettings(
            issuer_url=AnyHttpUrl(public_url),
            resource_server_url=AnyHttpUrl(public_url),
            required_scopes=[READ_SCOPE],
            validate_token_resource=True,
        ),
        token_verifier=CrmTokenVerifier(store, public_url),
    )

    @server.tool(description="Find a business by name or phone, or a contact by name, email, or phone.")
    def search(query: str, type: str | None = None) -> dict:
        return _call(reader, "search", lambda: reader.search(query, type))

    @server.tool(description="Find a contact by phone. A +1 query matches any punctuation of those ten digits.")
    def find_contact_by_phone(phone: str) -> dict:
        return _call(reader, "find_contact_by_phone", lambda: reader.find_contact_by_phone(phone))

    @server.tool(description="One business plus its contacts, activity, and tasks. Buddy also gets the active contract.")
    def get_business(id: str) -> dict:
        return _call(reader, "get_business", lambda: reader.get_business(id), row_id=id)

    @server.tool(description="One contact plus its contact notes. The id is a number.")
    def get_contact(id: int) -> dict:
        return _call(reader, "get_contact", lambda: reader.get_contact(id), row_id=id)

    @server.tool(description="Businesses, optionally filtered by lifecycle_stage. Default limit 25. Cap 50.")
    def list_businesses(stage: str | None = None, limit: int = 25) -> dict:
        return _call(reader, "list_businesses", lambda: reader.list_businesses(stage, limit))

    @server.tool(description="Contacts, optionally filtered by business_id. Default limit 25. Cap 50.")
    def list_contacts(business_id: str | None = None, limit: int = 25) -> dict:
        return _call(reader, "list_contacts", lambda: reader.list_contacts(business_id, limit), row_id=business_id or "")

    @server.tool(description="Tasks filtered by status, assignee, business, due range, or tag.")
    def list_tasks(
        status: str | None = None,
        assigned_to: str | None = None,
        business_id: str | None = None,
        due_from: str | None = None,
        due_to: str | None = None,
        tag: str | None = None,
        limit: int = 25,
    ) -> dict:
        return _call(
            reader,
            "list_tasks",
            lambda: reader.list_tasks(status, assigned_to, business_id, due_from, due_to, tag, limit),
            row_id=business_id or "",
        )

    @server.tool(description="Activity rows for one business. This is wpa_activity, not contact notes.")
    def list_activity(business_id: str) -> dict:
        return _call(reader, "list_activity", lambda: reader.list_activity(business_id), row_id=business_id)

    @server.tool(description="Create a lead contact, or return the existing contact for this phone unchanged.")
    def create_contact(
        phone: str,
        first_name: str | None = None,
        last_name: str | None = None,
        business_name: str | None = None,
        source: str | None = None,
        notes: str | None = None,
    ) -> dict:
        return _call(
            reader,
            "create_contact",
            lambda: reader.create_contact(phone, first_name, last_name, business_name, source, notes),
        )

    @server.tool(description="Append a contact note. Does not change the contact notes field.")
    def add_contact_note(contact_id: int, body: str) -> dict:
        return _call(
            reader,
            "add_contact_note",
            lambda: reader.add_contact_note(contact_id, body),
            row_id=contact_id,
        )

    @server.tool(description="Log activity on a business. Pass contact_id or business_id. inbound_call is a valid type.")
    def log_activity(
        type: str,
        summary: str,
        contact_id: int | None = None,
        business_id: str | None = None,
    ) -> dict:
        def run():
            return reader.log_activity(
                type,
                summary,
                _actor(_label()),
                contact_id=contact_id,
                business_id=business_id,
            )

        return _call(reader, "log_activity", run, row_id=business_id or contact_id or "")

    @server.tool(description="Create a follow-up task on a business. Pass contact_id or business_id.")
    def create_task(
        title: str,
        contact_id: int | None = None,
        business_id: str | None = None,
        due_date: str | None = None,
    ) -> dict:
        def run():
            return reader.create_task(
                title,
                _label(),
                contact_id=contact_id,
                business_id=business_id,
                due_date=due_date,
            )

        return _call(reader, "create_task", run, row_id=business_id or contact_id or "")

    @server.tool(description="Buddy only. Update email, name, last_name, or role. Other fields are rejected.")
    def update_contact(
        id: int,
        email: str | None = None,
        name: str | None = None,
        last_name: str | None = None,
        role: str | None = None,
        phone: str | None = None,
        notes: str | None = None,
        lifecycle_stage: str | None = None,
    ) -> dict:
        fields = {}
        for key, value in (
            ("email", email),
            ("name", name),
            ("last_name", last_name),
            ("role", role),
            ("phone", phone),
            ("notes", notes),
            ("lifecycle_stage", lifecycle_stage),
        ):
            if value is not None:
                fields[key] = value
        return _call(
            reader,
            "update_contact",
            lambda: reader.update_contact(id, fields),
            row_id=id,
        )

    return server


async def _health(_request):
    return JSONResponse({"status": "ok"})


class PathAliasMiddleware:
    """Accept the public /crm/mcp path and the in-process /mcp path."""

    def __init__(self, app, aliases: dict[str, str]):
        self.app = app
        self.aliases = aliases

    async def __call__(self, scope, receive, send):
        path = scope.get("path")
        if scope.get("type") == "http" and path in self.aliases:
            scope = dict(scope)
            scope["path"] = self.aliases[path]
            scope["raw_path"] = self.aliases[path].encode()
        await self.app(scope, receive, send)


def build_app(
    store,
    reader,
    *,
    public_url: str,
    dns_rebinding_protection: bool = False,
    allowed_hosts: list[str] | None = None,
    allowed_origins: list[str] | None = None,
):
    server = build_server(store, reader, public_url=public_url)
    if dns_rebinding_protection:
        security = TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=allowed_hosts or [
                "whitepine-tech.com",
                "whitepine-tech.com:*",
                "localhost:*",
                "127.0.0.1:*",
            ],
            allowed_origins=allowed_origins or [
                "https://whitepine-tech.com",
                "http://localhost:*",
                "http://127.0.0.1:*",
            ],
        )
    else:
        security = TransportSecuritySettings(enable_dns_rebinding_protection=False)
    app = server.streamable_http_app(
        streamable_http_path="/mcp",
        json_response=True,
        stateless_http=True,
        transport_security=security,
        host="0.0.0.0",
    )
    app.add_middleware(PathAliasMiddleware, aliases={PUBLIC_PATH: "/mcp"})
    app.router.routes.insert(0, Route("/health", _health, methods=["GET"]))
    return app
