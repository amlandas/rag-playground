from __future__ import annotations

from fastapi import Response

from app.config import settings
from app.services import session_auth


def test_cookie_flags_for_public_origins(monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_ORIGINS", "https://rag-playground-web.example.com, http://localhost:3000")
    monkeypatch.setattr(settings, "SESSION_SECRET", "secret")
    response = Response()
    session_auth.set_session_cookie(response, "token")
    header = response.headers.get("set-cookie")
    assert header is not None
    assert "samesite=none" in header.lower()
    assert "Secure" in header


def test_cookie_flags_for_local_only(monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_ORIGINS", "http://localhost:3000,http://127.0.0.1:3001")
    monkeypatch.setattr(settings, "SESSION_SECRET", "secret")
    response = Response()
    session_auth.set_session_cookie(response, "token")
    header = response.headers.get("set-cookie")
    assert header is not None
    lower = header.lower()
    assert "samesite=none" not in lower
    assert "samesite=lax" in lower
    assert "Secure" not in header
