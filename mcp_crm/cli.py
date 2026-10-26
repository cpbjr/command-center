"""Mint or revoke a CRM MCP bearer token.

The raw token is printed once. Only its hash is stored.
Do not run this against live Supabase from the test path.
"""
import argparse
import sys

from mcp_crm.__main__ import wpa_client
from mcp_crm.tokens import SupabaseTokenStore


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Mint or revoke a CRM MCP token.")
    sub = parser.add_subparsers(dest="command", required=True)
    mint = sub.add_parser("mint")
    mint.add_argument("--user-id", required=True)
    mint.add_argument("--label", default="grok")
    revoke = sub.add_parser("revoke")
    revoke.add_argument("--token-id", required=True)
    args = parser.parse_args(argv)
    store = SupabaseTokenStore(wpa_client())
    if args.command == "mint":
        raw, record = store.mint(args.user_id, args.label)
        print(raw)
        print(f"token_id={record.token_id}", file=sys.stderr)
        return 0
    if not store.revoke(args.token_id):
        print("token not found or already revoked", file=sys.stderr)
        return 1
    print("revoked")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
