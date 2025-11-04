from app.services.compose import postprocess_chunk
from app.services.generate import _normalize_stream_chunk


def _stream_roundtrip(text: str) -> str:
    tail = ""
    output = []
    for ch in text:
        chunk = postprocess_chunk(ch)
        normalized, tail = _normalize_stream_chunk(chunk, tail)
        output.append(normalized)
    return ''.join(output)


def test_product_names_preserved_through_stream_normalization():
    original = "OptiPlex Micro\nOptiPlex Micro Plus\nDell Pro 24 All-in-One 35W"
    result = _stream_roundtrip(original)
    assert "OptiPlex Micro" in result
    assert "OptiPlex Micro Plus" in result
    assert "Dell Pro 24 All-in-One 35W" in result


def test_postprocess_minimal_changes():
    raw = "Line one.\n\n\nLine two."  # extra blank lines collapse
    cleaned = postprocess_chunk(raw)
    assert cleaned.count("Line") == 2
    assert cleaned.count("\n\n") == 1


def test_postprocess_model_prior_cleanup():
    raw = "This note *(model prior)* should be normalized."
    cleaned = postprocess_chunk(raw)
    assert "(model prior)" in cleaned


def test_postprocess_chunk_sentence_spacing():
    sample = "This is good.The next line starts soon!Another line?"
    cleaned = postprocess_chunk(sample)
    assert cleaned == sample
