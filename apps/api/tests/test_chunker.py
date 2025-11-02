from app.services.chunk import chunk_text


def test_chunker_basic_overlap():
    text = "A" * 2000
    chunks = chunk_text(text, chunk_size=500, overlap=100)
    assert len(chunks) >= 3
    _, end_first, _ = chunks[0]
    start_second, _, _ = chunks[1]
    assert start_second < end_first
