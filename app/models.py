from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class PageDocument:
    source: str
    page: int
    text: str
    path: str


@dataclass(frozen=True)
class Chunk:
    id: str
    source: str
    page: int
    chunk_id: int
    text: str
    path: str

    @property
    def citation(self) -> str:
        return f"{self.source} p. {self.page}"


@dataclass
class SearchHit:
    chunk: Chunk
    score: float = 0.0
    vector_rank: int | None = None
    keyword_rank: int | None = None
    vector_distance: float | None = None
    keyword_bm25: float | None = None
    rerank_score: float = 0.0
    matched_terms: list[str] = field(default_factory=list)
    subqueries: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.chunk.id,
            "source": self.chunk.source,
            "page": self.chunk.page,
            "chunk_id": self.chunk.chunk_id,
            "text": self.chunk.text,
            "citation": self.chunk.citation,
            "score": round(self.score, 6),
            "rerank_score": round(self.rerank_score, 6),
            "explanation": {
                "vector_rank": self.vector_rank,
                "keyword_rank": self.keyword_rank,
                "vector_distance": None if self.vector_distance is None else round(self.vector_distance, 6),
                "keyword_bm25": None if self.keyword_bm25 is None else round(self.keyword_bm25, 6),
                "matched_terms": self.matched_terms,
                "subqueries": self.subqueries,
                "fusion": "reciprocal_rank_fusion(k=60)",
            },
        }
