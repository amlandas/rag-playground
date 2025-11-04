from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request, Response

from ..config import settings

SESSION_COOKIE_NAME = "rag_session"


@dataclass
class SessionUser:
    sub: str
    email: str
    is_admin: bool = False


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _session_expiry_ts() -> int:
    return int(time.time() + settings.SESSION_TTL_MINUTES * 60)


def encode_session_token(payload: Dict[str, Any]) -> str:
    body = dict(payload)
    body.setdefault("exp", _session_expiry_ts())
    body_bytes = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(settings.SESSION_SECRET.encode("utf-8"), body_bytes, hashlib.sha256).digest()
    return f"{_b64encode(body_bytes)}.{_b64encode(signature)}"


def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        encoded_body, encoded_sig = token.split(".", 1)
    except ValueError:
        return None
    try:
        body_bytes = _b64decode(encoded_body)
        supplied_sig = _b64decode(encoded_sig)
    except (ValueError, binascii.Error):
        return None  # type: ignore[name-defined]

    expected_sig = hmac.new(settings.SESSION_SECRET.encode("utf-8"), body_bytes, hashlib.sha256).digest()
    if not hmac.compare_digest(expected_sig, supplied_sig):
        return None

    try:
        data = json.loads(body_bytes)
    except json.JSONDecodeError:
        return None

    exp = data.get("exp")
    if exp is not None and time.time() > float(exp):
        return None
    return data


def cookie_secure_flag() -> bool:
    origins = settings.ALLOW_ORIGINS or ""
    if not origins:
        return False
    lowered = origins.lower()
    if "localhost" in lowered or "127.0.0.1" in lowered:
        return False
    return True


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=settings.SESSION_TTL_MINUTES * 60,
        httponly=True,
        secure=cookie_secure_flag(),
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")


def _user_from_token(token: str) -> Optional[SessionUser]:
    data = decode_session_token(token)
    if not data:
        return None
    sub = data.get("sub")
    email = data.get("email")
    if not sub or not email:
        return None
    return SessionUser(sub=sub, email=email, is_admin=bool(data.get("is_admin")))


def get_session_user(request: Request) -> Optional[SessionUser]:
    if not settings.GOOGLE_AUTH_ENABLED:
        return None
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    user = _user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user


def maybe_require_auth(user: Optional[SessionUser]) -> Optional[SessionUser]:
    if not settings.GOOGLE_AUTH_ENABLED:
        return None
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_admin(user: Optional[SessionUser]) -> Optional[SessionUser]:
    if not settings.GOOGLE_AUTH_ENABLED:
        return None
    actual = maybe_require_auth(user)
    if not actual or not actual.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return actual
