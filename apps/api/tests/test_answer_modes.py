from types import SimpleNamespace

import pytest

from app.services.pipeline import compute_confidence, resolve_answer_mode
from app.services.retrieve import RetrievalHit


def test_resolve_answer_mode_defaults(monkeypatch):
    monkeypatch.setattr("app.services.pipeline.settings", SimpleNamespace(ANSWER_MODE_DEFAULT="blended"))
    assert resolve_answer_mode(None) == "blended"
    assert resolve_answer_mode("  unknown  ") == "blended"


def test_resolve_answer_mode_overrides(monkeypatch):
    monkeypatch.setattr("app.services.pipeline.settings", SimpleNamespace(ANSWER_MODE_DEFAULT="grounded"))
    assert resolve_answer_mode("blended") == "blended"
    assert resolve_answer_mode("GROUNDed") == "grounded"


@pytest.mark.parametrize(
    "scores,floor,rerank_scores,insufficient,expected",
    [
        ([0.5, 0.42, 0.4], 0.18, [0.6, 0.55], False, "high"),
        ([0.27, 0.24, 0.2], 0.18, [0.4], False, "medium"),
        ([0.19], 0.18, [], False, "medium"),
        ([0.15], 0.18, [], False, "low"),
        ([], 0.18, [], True, "low"),
    ],
)
def test_compute_confidence_levels(scores, floor, rerank_scores, insufficient, expected):
    hits = [
        RetrievalHit(idx=i, dense_score=score, lexical_score=0.0, fused_score=score)
        for i, score in enumerate(scores)
    ]
    assert compute_confidence(hits, floor, rerank_scores, insufficient) == expected
