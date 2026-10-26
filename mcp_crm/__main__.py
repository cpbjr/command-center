"""CRM MCP process entry. Read only. Starts uvicorn. Does not call Supabase in tests."""
import os

try:
    import uvicorn
except ImportError:
    uvicorn = None

from mcp_crm.live import SupabaseCrmReader
from mcp_crm.server import build_app
from mcp_crm.tokens import StaticTokenStore, SupabaseTokenStore


PUBLIC_URL = "https://whitepine-tech.com/crm/mcp"


class FallbackTokenStore:
    """Accept a Supabase token, and a static token when both env vars are set."""

    def __init__(self, stores):
        self.stores = list(stores)

    def verify(self, token):
        for store in self.stores:
            record = store.verify(token)
            if record is not None:
                return record
        return None


def wpa_client():
    """Service-role client scoped to schema wpa. Not used by tests."""
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key).schema("wpa")


def main() -> int:
    public_url = os.getenv("MCP_PUBLIC_URL", PUBLIC_URL)
    host = "0.0.0.0"
    port = int(os.getenv("MCP_PORT", "8000"))
    client = wpa_client()
    store = SupabaseTokenStore(client)
    raw = os.getenv("MCP_API_TOKEN")
    user_id = os.getenv("MCP_USER_ID")
    if raw and user_id:
        store = FallbackTokenStore([store, StaticTokenStore(raw, user_id)])
    elif raw or user_id:
        raise SystemExit("Set both MCP_API_TOKEN and MCP_USER_ID, or neither.")
    app = build_app(
        store,
        SupabaseCrmReader(client),
        public_url=public_url,
    )
    if uvicorn is None:
        raise SystemExit("uvicorn is not installed")
    uvicorn.run(app, host=host, port=port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
