import pytest

from app.config import Settings


def make_settings(monkeypatch, **env_overrides):
    keys = [
        "RERANK_STRATEGY",
        "RERANK__STRATEGY",
        "RAG_RERANK_STRATEGY",
        "RERANK_STRICT",
        "ANSWER_MODE_DEFAULT",
        "ANSWER__MODE_DEFAULT",
        "RAG_ANSWER_MODE_DEFAULT",
        "ANSWER_CONFIDENCE_ENABLED",
        "ANSWER__CONFIDENCE_ENABLED",
        "RAG_ANSWER_CONFIDENCE_ENABLED",
    ]
    for key in keys:
        if key not in env_overrides:
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", env_overrides.get("OPENAI_API_KEY", "test-key"))
    monkeypatch.setenv("EMBEDDINGS_PROVIDER", env_overrides.get("EMBEDDINGS_PROVIDER", "fake"))
    for key, value in env_overrides.items():
        monkeypatch.setenv(key, value)
    # Instantiate without relying on module-level singleton
    return Settings()


@pytest.mark.parametrize(
    "env_key,value,expected",
    [
        ("RERANK_STRATEGY", "llm", "llm"),
        ("RERANK__STRATEGY", "ce", "ce"),
        ("RAG_RERANK_STRATEGY", "none", "none"),
    ],
)
def test_rerank_strategy_aliases(monkeypatch, env_key, value, expected):
    settings = make_settings(monkeypatch, **{env_key: value})
    assert settings.RERANK_STRATEGY == expected


def test_rerank_strategy_precedence(monkeypatch):
    settings = make_settings(
        monkeypatch,
        RERANK_STRATEGY="llm",
        RERANK__STRATEGY="ce",
        RAG_RERANK_STRATEGY="none",
    )
    assert settings.RERANK_STRATEGY == "llm"


def test_rerank_strategy_second_precedence(monkeypatch):
    settings = make_settings(
        monkeypatch,
        RERANK__STRATEGY="ce",
        RAG_RERANK_STRATEGY="llm",
    )
    assert settings.RERANK_STRATEGY == "ce"


def test_rerank_strategy_trims_quotes(monkeypatch):
    settings = make_settings(monkeypatch, RERANK_STRATEGY="  'llm'  ")
    assert settings.RERANK_STRATEGY == "llm"


@pytest.mark.parametrize(
    "env_key,value",
    [
        ("ANSWER_MODE_DEFAULT", "blended"),
        ("ANSWER__MODE_DEFAULT", "blended"),
        ("RAG_ANSWER_MODE_DEFAULT", "grounded"),
    ],
)
def test_answer_mode_aliases(monkeypatch, env_key, value):
    settings = make_settings(monkeypatch, **{env_key: value})
    expected = value.strip().lower()
    if expected not in {"grounded", "blended"}:
        expected = "grounded"
    assert settings.ANSWER_MODE_DEFAULT == expected


def test_answer_mode_invalid_falls_back(monkeypatch):
    settings = make_settings(monkeypatch, ANSWER_MODE_DEFAULT="invalid-mode")
    assert settings.ANSWER_MODE_DEFAULT == "grounded"


def test_answer_confidence_toggle(monkeypatch):
    settings = make_settings(monkeypatch, ANSWER_CONFIDENCE_ENABLED="false")
    assert settings.ANSWER_CONFIDENCE_ENABLED is False
