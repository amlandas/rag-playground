from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel

from ..config import settings
from ..services.runtime_config import google_auth_enabled_effective
from ..services.session_auth import clear_session_cookie, encode_session_token, get_session_user, set_session_cookie

router = APIRouter(prefix="/api/auth", tags=["auth"])


class GoogleAuthRequest(BaseModel):
    id_token: str


@router.post("/google")
def authenticate_with_google(payload: GoogleAuthRequest, response: Response):
    if not google_auth_enabled_effective():
        raise HTTPException(status_code=400, detail="Google authentication is disabled")

    try:
        info = id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google ID token") from exc

    aud = info.get("aud")
    email = info.get("email")
    sub = info.get("sub")
    if aud != settings.GOOGLE_CLIENT_ID or not email or not sub:
        raise HTTPException(status_code=401, detail="Invalid Google credentials")

    admin_email = (settings.ADMIN_GOOGLE_EMAIL or "").lower()
    is_admin = bool(admin_email and email.lower() == admin_email)

    token = encode_session_token({"sub": sub, "email": email, "is_admin": is_admin})
    set_session_cookie(response, token)
    return {"email": email, "is_admin": is_admin}


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(request: Request, response: Response):
    if not google_auth_enabled_effective():
        return {"authenticated": False}
    try:
        user = get_session_user(request)
    except HTTPException:
        clear_session_cookie(response)
        return {"authenticated": False}
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "email": user.email, "is_admin": user.is_admin}
