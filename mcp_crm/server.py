"""Streamable HTTP MCP server for Command Center CRM. Read only."""
import logging

from mcp.server.auth.provider import AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import AnyHttpUrl

from mcp_crm.tokens import hash_token


logger = logging.getLogger("mcp_crm")

READ_SCOPE = "crm:read"
PUBLIC_PATH = "/crm/mcp"


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
        )


def _subject() -> str:
    from mcp.server.auth.middleware.auth_context import get_access_token

    token = get_access_token()
    if token is None or not token.subject:
        raise PermissionError("Missing subject")
    return token.subject


def _log_call(name: str, subject: str) -> None:
    logger.info("mcp call tool=%s subject=%s", name, subject)


def build_server(store, reader, *, public_url: str) -> MCPServer:
    server = MCPServer(
        name="command-center-crm",
        title="Command Center CRM",
        instructions=(
            "Read-only tools for the Command Center book. "
            "A business id is text. A contact id is a number. "
            "There is no deals table. Do not create, update, archive, or move records. "
            "list limits default to 25 and cap at 50. "
            "Every result includes an id and a message."
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
        _log_call("search", _subject())
        return reader.search(query, type)

    @server.tool(description="One business plus its contacts, activity, and tasks.")
    def get_business(id: str) -> dict:
        _log_call("get_business", _subject())
        return reader.get_business(id)

    @server.tool(description="One contact plus its contact notes. The id is a number.")
    def get_contact(id: int) -> dict:
        _log_call("get_contact", _subject())
        return reader.get_contact(id)

    @server.tool(description="Businesses, optionally filtered by lifecycle_stage. Default limit 25. Cap 50.")
    def list_businesses(stage: str | None = None, limit: int = 25) -> dict:
        _log_call("list_businesses", _subject())
        return reader.list_businesses(stage, limit)

    @server.tool(description="Contacts, optionally filtered by business_id. Default limit 25. Cap 50.")
    def list_contacts(business_id: str | None = None, limit: int = 25) -> dict:
        _log_call("list_contacts", _subject())
        return reader.list_contacts(business_id, limit)

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
        _log_call("list_tasks", _subject())
        return reader.list_tasks(status, assigned_to, business_id, due_from, due_to, tag, limit)

    @server.tool(description="Activity rows for one business. This is wpa_activity, not contact notes.")
    def list_activity(business_id: str) -> dict:
        _log_call("list_activity", _subject())
        return reader.list_activity(business_id)

    return server


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
    return app
