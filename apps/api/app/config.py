import os

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    OPENAI_API_KEY: str | None = None
    OPENAI_BASE_URL: str | None = None
    SESSION_TTL_MINUTES: int = 30
    EMBEDDINGS_PROVIDER: str = "openai"
    GOOGLE_AUTH_ENABLED: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "GOOGLE_AUTH_ENABLED",
            "GOOGLE__AUTH_ENABLED",
            "RAG_GOOGLE_AUTH_ENABLED",
        ),
    )
    GOOGLE_CLIENT_ID: str | None = None
    ADMIN_GOOGLE_EMAIL: str | None = None
    SESSION_SECRET: str | None = None

    # Safety / limits (dev-friendly defaults; override via env in prod)
    MAX_FILES_PER_UPLOAD: int = 20
    MAX_FILE_MB: int = 100
    MAX_PAGES_PER_PDF: int = 2000
    MAX_QUERIES_PER_SESSION: int = 20
    SIMILARITY_FLOOR: float = 0.18
    MAX_RETRIEVED: int = 8
    MIN_RETRIEVAL_SIMILARITY: float | None = None  # legacy override hook
    ALLOW_ORIGINS: str | None = None

    # Retrieval knobs
    RETRIEVER_STRATEGY: str = "hybrid"  # 'dense' or 'hybrid'
    DENSE_K: int = 40
    LEXICAL_K: int = 40
    FUSION_RRF_K: int = 60
    USE_MMR: bool = True
    MMR_LAMBDA: float = 0.7
    ANSWER_TOP_K: int = 8
    FALLBACK_WIDEN_K: int = 30

    # Reranking
    RERANK_STRATEGY: str = Field(
        default="ce",
        validation_alias=AliasChoices("RERANK_STRATEGY", "RERANK__STRATEGY", "RAG_RERANK_STRATEGY"),
    )
    RERANK_TOP_N: int = 30
    RERANK_KEEP: int = 8
    CE_MODEL_NAME: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    LLM_RERANK_MODEL: str = "gpt-4o-mini"
    LLM_RERANK_MAX_CHARS: int = 1200
    RERANK_STRICT: bool = Field(
        default=False,
        validation_alias=AliasChoices("RERANK_STRICT", "RERANK__STRICT", "RAG_RERANK_STRICT"),
    )

    # Answer formatting
    ANSWER_MODE_DEFAULT: str = Field(
        default="grounded",
        validation_alias=AliasChoices(
            "ANSWER_MODE_DEFAULT",
            "ANSWER__MODE_DEFAULT",
            "RAG_ANSWER_MODE_DEFAULT",
        ),
    )
    ANSWER_CONFIDENCE_ENABLED: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "ANSWER_CONFIDENCE_ENABLED",
            "ANSWER__CONFIDENCE_ENABLED",
            "RAG_ANSWER_CONFIDENCE_ENABLED",
        ),
    )
    ANSWER_MD: bool = Field(
        default=True,
        validation_alias=AliasChoices("ANSWER_MD", "ANSWER__MD", "RAG_ANSWER_MD"),
    )
    ANSWER_TONE: str = Field(
        default="concise",
        validation_alias=AliasChoices("ANSWER_TONE", "ANSWER__TONE", "RAG_ANSWER_TONE"),
    )
    ANSWER_MAX_TOKENS: int = Field(
        default=800,
        validation_alias=AliasChoices("ANSWER_MAX_TOKENS", "ANSWER__MAX_TOKENS", "RAG_ANSWER_MAX_TOKENS"),
    )
    ANSWER_TEMP: float = Field(
        default=0.2,
        validation_alias=AliasChoices("ANSWER_TEMP", "ANSWER__TEMP", "RAG_ANSWER_TEMP"),
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("EMBEDDINGS_PROVIDER", mode="before")
    @classmethod
    def _normalize_provider(cls, value: str | None) -> str:
        return (value or "openai").strip().lower()

    @field_validator("RERANK_STRATEGY", mode="before")
    @classmethod
    def _normalize_rerank_strategy(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = str(value).strip().strip("'\"").strip()
        return cleaned or None

    @field_validator("ANSWER_TONE", mode="before")
    @classmethod
    def _normalize_answer_tone(cls, value: str | None) -> str:
        if value is None:
            return "concise"
        cleaned = str(value).strip().lower()
        allowed = {"concise", "neutral", "detailed"}
        if cleaned not in allowed:
            return "concise"
        return cleaned

    @field_validator("ANSWER_MODE_DEFAULT", mode="before")
    @classmethod
    def _normalize_answer_mode(cls, value: str | None) -> str:
        if value is None:
            return "grounded"
        cleaned = str(value).strip().lower()
        allowed = {"grounded", "blended"}
        if cleaned not in allowed:
            return "grounded"
        return cleaned

    @model_validator(mode="after")
    def _finalize(self) -> "Settings":
        if self.MIN_RETRIEVAL_SIMILARITY is not None:
            object.__setattr__(self, "SIMILARITY_FLOOR", self.MIN_RETRIEVAL_SIMILARITY)
        object.__setattr__(self, "RETRIEVER_STRATEGY", (self.RETRIEVER_STRATEGY or "hybrid").strip().lower())
        object.__setattr__(self, "RERANK_STRATEGY", (self.RERANK_STRATEGY or "none").strip().lower())
        if self.EMBEDDINGS_PROVIDER != "fake" and not self.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is required unless EMBEDDINGS_PROVIDER=fake")
        if not self.SESSION_SECRET:
            import secrets

            object.__setattr__(self, "SESSION_SECRET", secrets.token_urlsafe(48))

        if self.GOOGLE_AUTH_ENABLED:
            if not self.GOOGLE_CLIENT_ID:
                raise ValueError("GOOGLE_CLIENT_ID is required when GOOGLE_AUTH_ENABLED=true")
            if not os.getenv("SESSION_SECRET"):
                raise ValueError("SESSION_SECRET environment variable is required when GOOGLE_AUTH_ENABLED=true")
        return self


settings = Settings()

print(
    "[CONFIG] rerank strategy effective="
    f"{settings.RERANK_STRATEGY} "
    f"(top_n={settings.RERANK_TOP_N}, keep={settings.RERANK_KEEP}) "
    f"env: RERANK_STRATEGY={os.getenv('RERANK_STRATEGY')} "
    f"RERANK__STRATEGY={os.getenv('RERANK__STRATEGY')} "
    f"RAG_RERANK_STRATEGY={os.getenv('RAG_RERANK_STRATEGY')}"
)
print(
    "[CONFIG] answer formatting: "
    f"mode_default={settings.ANSWER_MODE_DEFAULT} "
    f"markdown={settings.ANSWER_MD} tone={settings.ANSWER_TONE} "
    f"max_tokens={settings.ANSWER_MAX_TOKENS} temp={settings.ANSWER_TEMP} "
    f"confidence_feature={settings.ANSWER_CONFIDENCE_ENABLED}"
)
print(
    "[CONFIG] auth: "
    f"google_enabled={settings.GOOGLE_AUTH_ENABLED} "
    f"client_id={'yes' if settings.GOOGLE_CLIENT_ID else 'no'} "
    f"admin_email={'set' if settings.ADMIN_GOOGLE_EMAIL else 'unset'}"
)
