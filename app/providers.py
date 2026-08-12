from __future__ import annotations

import re
from abc import ABC, abstractmethod

from .models import SearchHit
from .retrieval import tokenize


class RagProvider(ABC):
    """Provider seam for replacing deterministic offline logic with a local/remote LLM."""

    @abstractmethod
    def rewrite(self, question: str, history: list[dict[str, str]]) -> str: ...

    @abstractmethod
    def decompose(self, question: str) -> list[str]: ...

    @abstractmethod
    def rerank(self, query: str, hits: list[SearchHit]) -> list[SearchHit]: ...

    @abstractmethod
    def answer(self, question: str, hits: list[SearchHit]) -> tuple[str, list[str]]: ...


class DeterministicProvider(RagProvider):
    """Fully offline and reproducible RAG orchestration used by tests and demos."""

    pronouns = re.compile(r"\b(it|its|they|them|that|this|those|these|它|它的|他们|这个|那个)\b", re.I)

    def rewrite(self, question: str, history: list[dict[str, str]]) -> str:
        clean = " ".join(question.split())
        if history and self.pronouns.search(clean):
            prior = next((item["content"] for item in reversed(history) if item.get("role") == "user"), "")
            if prior:
                return f"{clean} Context from previous question: {prior}"
        return clean

    def decompose(self, question: str) -> list[str]:
        clean = " ".join(question.split())
        parts = re.split(r"\s+(?:and|versus|vs\.?|then|以及|并且|相比|然后)\s+|[;；]", clean, flags=re.I)
        subqueries = [part.strip(" ,，?") for part in parts if len(tokenize(part)) >= 2]
        return list(dict.fromkeys(subqueries))[:4] or [clean]

    def rerank(self, query: str, hits: list[SearchHit]) -> list[SearchHit]:
        terms = set(tokenize(query))
        lowered = query.casefold()
        for hit in hits:
            chunk_terms = set(tokenize(hit.chunk.text))
            coverage = len(terms & chunk_terms) / max(1, len(terms))
            phrase_bonus = 0.12 if lowered in hit.chunk.text.casefold() else 0.0
            dual_bonus = 0.08 if hit.vector_rank and hit.keyword_rank else 0.0
            hit.rerank_score = hit.score + 0.5 * coverage + phrase_bonus + dual_bonus
        return sorted(hits, key=lambda hit: (-hit.rerank_score, hit.chunk.id))

    def answer(self, question: str, hits: list[SearchHit]) -> tuple[str, list[str]]:
        terms = set(tokenize(question))
        candidates: list[tuple[int, int, str, str]] = []
        for hit_rank, hit in enumerate(hits):
            sentences = re.split(r"(?<=[.!?。！？])\s+", hit.chunk.text)
            for sentence in sentences:
                overlap = len(terms & set(tokenize(sentence)))
                candidates.append((overlap, -hit_rank, sentence.strip(), hit.chunk.citation))
        candidates.sort(reverse=True)
        chosen: list[tuple[str, str]] = []
        for overlap, _, sentence, citation in candidates:
            if not sentence or (overlap == 0 and chosen):
                continue
            if sentence not in [item[0] for item in chosen]:
                chosen.append((sentence, citation))
            if len(chosen) == 3:
                break
        citations = list(dict.fromkeys(citation for _, citation in chosen))
        answer = " ".join(f"{sentence} [{citation}]" for sentence, citation in chosen)
        return answer, citations
