"""CRM MCP process entry.

This cut does not start a live server and does not call Supabase.
The CLI imports wpa_client and calls it only when someone mints or revokes.
"""
import sys


def wpa_client():
    """Service-role client scoped to schema wpa. Not used by tests."""
    import os

    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key).schema("wpa")


def main() -> int:
    print("CRM MCP is not live in this cut.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
