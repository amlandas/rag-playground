from __future__ import annotations

import math
import re
from collections import Counter, deque
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Sequence, Tuple

STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "of",
    "in",
    "to",
    "for",
    "on",
    "with",
    "by",
    "is",
    "are",
    "be",
    "this",
    "that",
    "it",
    "as",
    "at",
    "from",
}

ENTITY_PATTERN = re.compile(r"\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b")


@dataclass
class GraphDoc:
    id: str
    title: str | None = None


@dataclass
class GraphSection:
    id: str
    doc_id: str
    chunk_index: int
    text: str


@dataclass
class GraphEntity:
    id: str
    name: str
    frequency: int = 0


@dataclass
class GraphEdge:
    source: str
    target: str
    kind: str


@dataclass
class GraphStore:
    docs: Dict[str, GraphDoc] = field(default_factory=dict)
    sections: Dict[str, GraphSection] = field(default_factory=dict)
    entities: Dict[str, GraphEntity] = field(default_factory=dict)
    edges: List[GraphEdge] = field(default_factory=list)
    adjacency: Dict[str, set[str]] = field(default_factory=dict)

    def add_edge(self, source: str, target: str, kind: str) -> None:
        edge = GraphEdge(source=source, target=target, kind=kind)
        self.edges.append(edge)
        self.adjacency.setdefault(source, set()).add(target)
        self.adjacency.setdefault(target, set()).add(source)


def normalize_entity_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).title()


def extract_candidate_entities(text: str, limit: int = 5) -> List[str]:
    if not text:
        return []
    matches = ENTITY_PATTERN.findall(text)
    normalized = [normalize_entity_name(match) for match in matches if match]
    counter = Counter(normalized)

    tokens = re.findall(r"\b[\w\-]+\b", text.lower())
    token_counter = Counter(t for t in tokens if t not in STOPWORDS and len(t) > 3)
    for token, freq in token_counter.most_common(limit):
        normalized_token = token.capitalize()
        counter[normalized_token] += freq

    entities = [name for name, _ in counter.most_common(limit)]
    seen = set()
    result: List[str] = []
    for entity in entities:
        key = entity.lower()
        if len(entity) < 3 or key in seen:
            continue
        seen.add(key)
        result.append(entity)
        if len(result) >= limit:
            break
    return result


def build_graph_store(documents: Dict[str, Dict[str, str]], chunk_map: Sequence[Tuple[str, int, int, str]]) -> GraphStore:
    store = GraphStore()
    for doc_id, doc in documents.items():
        store.docs[doc_id] = GraphDoc(id=doc_id, title=doc.get("name"))

    for idx, (doc_id, _start, _end, text) in enumerate(chunk_map):
        section_id = f"{doc_id}:{idx}"
        store.sections[section_id] = GraphSection(id=section_id, doc_id=doc_id, chunk_index=idx, text=text)
        store.add_edge(doc_id, section_id, "SUPPORTS")

        for entity_name in extract_candidate_entities(text):
            entity_key = entity_name.lower()
            if entity_key not in store.entities:
                store.entities[entity_key] = GraphEntity(id=entity_key, name=entity_name, frequency=1)
            else:
                store.entities[entity_key].frequency += 1
            store.add_edge(section_id, entity_key, "MENTIONS")
            store.add_edge(entity_key, doc_id, "REFERS_TO")

    return store


def plan_subqueries(query: str, max_subqueries: int = 3) -> List[str]:
    cleaned = query.strip()
    if not cleaned:
        return []
    parts = [part.strip() for part in re.split(r"[?.!]", cleaned) if part.strip()]
    if not parts:
        parts = [cleaned]
    subqueries: List[str] = []
    for part in parts:
        if len(subqueries) >= max_subqueries:
            break
        subqueries.append(part)
    if not subqueries:
        subqueries.append(cleaned)
    return subqueries[:max_subqueries]


def match_entities(store: GraphStore, query: str) -> List[str]:
    if not store.entities:
        return []
    lowered = query.lower()
    matches = []
    for key, entity in store.entities.items():
        if entity.name.lower() in lowered or any(token in key for token in lowered.split()):
            matches.append(key)
    if matches:
        return matches
    tokens = [tok for tok in re.findall(r"\w+", lowered) if tok not in STOPWORDS]
    for key, entity in sorted(store.entities.items(), key=lambda item: item[1].frequency, reverse=True):
        if any(token in key for token in tokens):
            matches.append(key)
        if len(matches) >= 5:
            break
    return matches


def traverse_graph(store: GraphStore, seeds: List[str], max_hops: int) -> Tuple[List[int], List[Dict[str, List[Dict[str, str]]]], int, int]:
    if not store.sections:
        return [], [], 0, 0
    max_hops = max(1, max_hops)
    visited = set()
    queue = deque()
    for seed in seeds:
        if seed in store.entities:
            queue.append((seed, [seed], 0))
            visited.add(seed)
    if not queue:
        for doc_id in list(store.docs.keys())[:2]:
            queue.append((doc_id, [doc_id], 0))
            visited.add(doc_id)

    discovered_sections: List[int] = []
    paths: List[Dict[str, List[Dict[str, str]]]] = []
    hops_used = 0
    while queue and len(discovered_sections) < 20:
        node_id, path, depth = queue.popleft()
        hops_used = max(hops_used, depth)
        neighbors = store.adjacency.get(node_id, set())
        for neighbor in neighbors:
            if neighbor in visited:
                continue
            visited.add(neighbor)
            next_path = path + [neighbor]
            if neighbor in store.sections:
                section = store.sections[neighbor]
                discovered_sections.append(section.chunk_index)
                paths.append(
                    {
                        "nodes": [
                            _describe_node(store, nid)
                            for nid in next_path
                        ]
                    }
                )
            if depth + 1 < max_hops:
                queue.append((neighbor, next_path, depth + 1))
    return discovered_sections, paths, hops_used, len(seeds)


def _describe_node(store: GraphStore, node_id: str) -> Dict[str, str]:
    if node_id in store.sections:
        section = store.sections[node_id]
        return {"id": node_id, "type": "section", "doc_id": section.doc_id}
    if node_id in store.docs:
        doc = store.docs[node_id]
        return {"id": node_id, "type": "doc", "title": doc.title or ""}
    if node_id in store.entities:
        entity = store.entities[node_id]
        return {"id": node_id, "type": "entity", "name": entity.name}
    return {"id": node_id, "type": "unknown"}
