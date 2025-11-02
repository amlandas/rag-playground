from fastapi import Request

from .services.session import cleanup_expired_sessions


async def cleanup_session_middleware(request: Request, call_next):
    cleanup_expired_sessions()
    response = await call_next(request)
    return response
