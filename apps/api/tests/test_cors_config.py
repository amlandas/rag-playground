from app.services.cors import cors_config_summary, DEFAULT_LOCAL_ORIGINS


def test_cors_summary_reports_source():
    origins, source = cors_config_summary("https://prod.example.com")
    assert origins == ["https://prod.example.com"]
    assert source == "env"

    fallback_origins, fallback_source = cors_config_summary("")
    assert fallback_source == "default"
    assert "http://localhost:3000" in fallback_origins


def test_default_cors_includes_production_web_origins():
    origins, source = cors_config_summary(None)
    assert source == "default"
    assert "https://rag-playground-web-908840126213.us-west1.run.app" in origins
    assert "https://rag-playground-web-fsx6dmftva-uw.a.run.app" in origins
    expected = set(DEFAULT_LOCAL_ORIGINS)
    assert set(origins) == expected
