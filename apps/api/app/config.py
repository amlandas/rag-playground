from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    OPENAI_API_KEY: str
    OPENAI_BASE_URL: str | None = None
    SESSION_TTL_MINUTES: int = 30

    # Safety / limits
    MAX_FILES_PER_UPLOAD: int = 6
    MAX_FILE_MB: int = 10
    MAX_PAGES_PER_PDF: int = 50
    MAX_QUERIES_PER_SESSION: int = 20
    MIN_RETRIEVAL_SIMILARITY: float = 0.18
    ALLOW_ORIGINS: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
