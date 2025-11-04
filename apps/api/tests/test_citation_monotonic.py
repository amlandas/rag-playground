from app.services.compose import AnswerSource, citation_mapping, prepare_sources


class MockHit:
    def __init__(self, idx: int):
        self.idx = idx


def test_prepare_sources_monotonic_ids():
    chunk_map = [
        ("docA", 0, 10, "Alpha"),
        ("docB", 10, 30, "Bravo"),
        ("docC", 30, 60, "Charlie"),
    ]
    hits = [MockHit(0), MockHit(2), MockHit(1)]
    sources, mapping = prepare_sources(hits, chunk_map, limit=3)

    assert [src.id for src in sources] == [1, 2, 3]
    assert mapping == {0: 1, 2: 2, 1: 3}

    citations = citation_mapping(sources)
    assert citations == [
        {"id": 1, "meta": {"doc_id": "docA", "span": [0, 10], "chunk_index": 0}},
        {"id": 2, "meta": {"doc_id": "docC", "span": [30, 60], "chunk_index": 2}},
        {"id": 3, "meta": {"doc_id": "docB", "span": [10, 30], "chunk_index": 1}},
    ]
