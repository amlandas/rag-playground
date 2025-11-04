from app.services.compose import postprocess_chunk


def test_postprocess_preserves_product_names():
    raw = "The document lists OptiPlex Micro and Dell Pro 24 All-in-One 35W."
    cleaned = postprocess_chunk(raw)
    assert "OptiPlex Micro" in cleaned
    assert "Dell Pro 24 All-in-One 35W" in cleaned


def test_postprocess_keeps_bullet_lines():
    raw = "These models include:\n- OptiPlex Micro\n- Dell Pro Slim Plus"
    cleaned = postprocess_chunk(raw)
    assert "These models include:" in cleaned
    assert "- OptiPlex Micro" in cleaned
    assert "- Dell Pro Slim Plus" in cleaned


def test_postprocess_chunk_idempotent():
    sample = "Line one.\n\nLine two."
    cleaned_once = postprocess_chunk(sample)
    cleaned_twice = postprocess_chunk(cleaned_once)
    assert cleaned_once == cleaned_twice


def test_postprocess_chunk_sentence_spacing():
    sample = "This is good.The next line starts soon!Another line?"
    cleaned = postprocess_chunk(sample)
    assert cleaned == sample
