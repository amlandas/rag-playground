from app.services.cors import cors_config_summary, effective_cors_origins, parse_cors_origins


def test_parse_cors_origins_trims_and_deduplicates():
    raw = " https://example.com ,http://localhost:3000, https://example.com "
    assert parse_cors_origins(raw) == ["https://example.com", "http://localhost:3000"]


def test_effective_cors_origins_falls_back_to_defaults():
    origins = effective_cors_origins(None)
    assert "http://localhost:3000" in origins
    assert "http://127.0.0.1:3000" in origins


def test_cors_summary_reports_source():
    origins, source = cors_config_summary("https://prod.example.com")
    assert origins == ["https://prod.example.com"]
    assert source == "env"

    fallback_origins, fallback_source = cors_config_summary("")
    assert fallback_source == "default"
    assert "http://localhost:3000" in fallback_origins
