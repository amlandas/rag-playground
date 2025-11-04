from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .middleware import cleanup_session_middleware
from .routers import answer, auth, compare, debug, feedback, health, ingest, metrics, query

app = FastAPI(title="RAG Playground API", version="0.1.0")

cors_origins = ["*"]
if settings.ALLOW_ORIGINS:
    cors_origins = [origin.strip() for origin in settings.ALLOW_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(cleanup_session_middleware)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router)
app.include_router(ingest.router, prefix="/api")
app.include_router(query.router, prefix="/api")
app.include_router(compare.router, prefix="/api")
app.include_router(answer.router, prefix="/api")
app.include_router(debug.router)
app.include_router(metrics.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
