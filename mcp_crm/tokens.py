"""Revocable bearer tokens scoped to one CRM subject.

The subject is text. Do not cast a Discord user id to uuid.
Only the hash is stored.
"""
import hashlib
import hmac
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone


logger = logging.getLogger("mcp_crm")

TOKEN_PREFIX = "crm_"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_token() -> str:
    return TOKEN_PREFIX + secrets.token_urlsafe(32)


@dataclass
class TokenRecord:
    token_id: str
    user_id: str
    token_hash: str
    label: str
    revoked: bool = False


class MemoryTokenStore:
    """In-memory store. Tests use this. No network."""

    def __init__(self):
        self._by_id = {}
        self._by_hash = {}

    def mint(self, user_id: str, label: str = "grok"):
        raw = generate_token()
        record = TokenRecord(
            token_id=str(uuid.uuid4()),
            user_id=str(user_id),
            token_hash=hash_token(raw),
            label=label,
        )
        self._by_id[record.token_id] = record
        self._by_hash[record.token_hash] = record
        return raw, record

    def revoke(self, token_id: str) -> bool:
        record = self._by_id.get(token_id)
        if record is None or record.revoked:
            return False
        record.revoked = True
        return True

    def verify(self, token: str):
        if not token:
            return None
        record = self._by_hash.get(hash_token(token))
        if record is None or record.revoked:
            return None
        return record


class SupabaseTokenStore:
    """Hashed tokens in wpa.mcp_api_tokens. The raw token is never stored."""

    table_name = "mcp_api_tokens"

    def __init__(self, client):
        self.client = client

    def mint(self, user_id: str, label: str = "grok"):
        raw = generate_token()
        record = TokenRecord(
            token_id=str(uuid.uuid4()),
            user_id=str(user_id),
            token_hash=hash_token(raw),
            label=label,
        )
        self.client.table(self.table_name).insert({
            "id": record.token_id,
            "user_id": record.user_id,
            "token_hash": record.token_hash,
            "label": label,
            "revoked_at": None,
        }).execute()
        return raw, record

    def revoke(self, token_id: str) -> bool:
        result = self.client.table(self.table_name).update({
            "revoked_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", token_id).is_("revoked_at", "null").execute()
        return bool(result.data)

    def verify(self, token: str):
        if not token:
            return None
        try:
            result = self.client.table(self.table_name).select(
                "id, user_id, token_hash, label, revoked_at"
            ).eq("token_hash", hash_token(token)).is_("revoked_at", "null").execute()
        except Exception:
            logger.warning("mcp token lookup failed", exc_info=True)
            return None
        if not result.data:
            return None
        row = result.data[0]
        return TokenRecord(
            token_id=row["id"],
            user_id=str(row["user_id"]),
            token_hash=row["token_hash"],
            label=row.get("label") or "",
            revoked=row.get("revoked_at") is not None,
        )


class StaticTokenStore:
    """One env token. Revoke it by removing the env var and restarting."""

    def __init__(self, raw: str, user_id: str, token_id: str = "env", label: str = "env"):
        self._hash = hash_token(raw)
        self.record = TokenRecord(
            token_id=token_id,
            user_id=str(user_id),
            token_hash=self._hash,
            label=label,
        )

    def verify(self, token: str):
        if not token or self.record.revoked:
            return None
        if hmac.compare_digest(hash_token(token), self._hash):
            return self.record
        return None

    def revoke(self, token_id: str) -> bool:
        if token_id != self.record.token_id or self.record.revoked:
            return False
        self.record.revoked = True
        return True
