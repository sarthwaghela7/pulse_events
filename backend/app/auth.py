import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from uuid import UUID

from fastapi import HTTPException, Request

COOKIE_NAME = "evntra_session"
SESSION_SECONDS = 60 * 60 * 24 * 7


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _secret() -> bytes:
    value = os.getenv("AUTH_SECRET", "")
    if len(value) < 32:
        raise RuntimeError("Set AUTH_SECRET to a random value of at least 32 characters")
    return value.encode()


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, salt, expected = encoded.split("$", 2)
        if algorithm != "scrypt":
            return False
        actual = hashlib.scrypt(password.encode(), salt=_b64decode(salt), n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(actual, _b64decode(expected))
    except (ValueError, TypeError):
        return False


def create_session(user_id: UUID) -> str:
    claims = {"sub": str(user_id), "exp": int(time.time()) + SESSION_SECONDS}
    payload = _b64encode(json.dumps(claims, separators=(",", ":")).encode())
    signature = _b64encode(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def read_session(token: str) -> UUID:
    try:
        payload, signature = token.split(".", 1)
        expected = _b64encode(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid signature")
        claims = json.loads(_b64decode(payload))
        if claims["exp"] < time.time():
            raise ValueError("Expired session")
        return UUID(claims["sub"])
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(401, "Invalid or expired session") from exc


def current_user_id(request: Request) -> UUID:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "Sign in required")
    return read_session(token)
