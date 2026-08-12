from __future__ import annotations

import json
import math
import sqlite3
import time
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

from .ingestion import IngestionError, build_chunks, load_documents
from .grounding import verify_answer
from .models import SearchHit
from .providers import DeterministicProvider, RagProvider
from .retrieval import HybridRetriever, RetrievalError, tokenize


NOT_ENOUGH_EVIDENCE = "I do not have enough grounded evidence in the indexed documents to answer this question."


class RagService:
    def __init__(self, docs_dir: Path, data_dir: Path, provider: RagProvider | None = None) -> None:
        self.docs_dir = docs_dir
        self.data_dir = data_dir
        self.retriever = HybridRetriever(data_dir)
        self.provider = provider or DeterministicProvider()
        self.sessions: dict[str, list[dict[str, str]]] = {}

    def index(self) -> dict[str, Any]:
        pages = load_documents(self.docs_dir)
        chunks = build_chunks(pages)
        self.retriever.index(chunks)
        return {
            "status": "indexed",
            "documents_indexed": len({page.source for page in pages}),
            "pages_indexed": len(pages),
            "chunks_indexed": len(chunks),
            "sources": sorted({page.source for page in pages}),
            "stores": {"vector": "ChromaDB", "keyword": "SQLite FTS5"},
            "embedding": self.retriever.embedding.name(),
        }

    def health(self) -> dict[str, Any]:
        ready = self.retriever.is_ready
        return {
            "status": "ok",
            "index_ready": ready,
            "chunks_indexed": self.retriever.count(),
            "vector_store": "ChromaDB",
            "keyword_store": "SQLite FTS5",
            "provider": self.provider.__class__.__name__,
        }

    def ask(self, question: str, top_k: int = 5, session_id: str | None = None) -> dict[str, Any]:
        clean = " ".join(question.split())
        if not clean:
            raise ValueError("empty question")
        session_id = session_id or str(uuid.uuid4())
        history = self.sessions.setdefault(session_id, [])
        rewritten = self.provider.rewrite(clean, history)
        subqueries = self.provider.decompose(rewritten)
        merged: dict[str, SearchHit] = {}
        for subquery in subqueries:
            for hit in self.retriever.search(subquery, top_k=max(top_k * 2, 8)):
                if hit.chunk.id not in merged:
                    merged[hit.chunk.id] = hit
                else:
                    current = merged[hit.chunk.id]
                    current.score += hit.score
                    current.vector_rank = min(filter(None, [current.vector_rank, hit.vector_rank]), default=None)
                    current.keyword_rank = min(filter(None, [current.keyword_rank, hit.keyword_rank]), default=None)
                    current.matched_terms = sorted(set(current.matched_terms + hit.matched_terms))
                merged[hit.chunk.id].subqueries.append(subquery)

        ranked = self.provider.rerank(rewritten, list(merged.values()))[:top_k]
        confidence = self._confidence(rewritten, ranked)
        grounded = confidence >= 0.34 and bool(ranked)
        if grounded:
            answer, citations = self.provider.answer(rewritten, ranked)
            answer, sentence_verdicts = verify_answer(answer, ranked)
            citations = list(dict.fromkeys(verdict.citation for verdict in sentence_verdicts if verdict.supported and verdict.citation))
            grounded = bool(answer and citations) and all(verdict.supported for verdict in sentence_verdicts)
        else:
            answer, citations, sentence_verdicts = NOT_ENOUGH_EVIDENCE, [], []
        if not grounded:
            answer, citations = NOT_ENOUGH_EVIDENCE, []

        history.extend([{"role": "user", "content": clean}, {"role": "assistant", "content": answer}])
        del history[:-12]
        return {
            "session_id": session_id,
            "question": clean,
            "rewritten_query": rewritten,
            "subqueries": subqueries,
            "answer": answer,
            "confidence": round(confidence, 4),
            "grounded": grounded,
            "citations": citations,
            "sentence_grounding": [verdict.as_dict() for verdict in sentence_verdicts],
            "results": [hit.as_dict() for hit in ranked],
        }

    def _confidence(self, query: str, hits: list[SearchHit]) -> float:
        if not hits:
            return 0.0
        terms = set(tokenize(query))
        coverage = len(terms & set().union(*(set(hit.matched_terms) for hit in hits))) / max(1, len(terms))
        agreement = sum(bool(hit.vector_rank and hit.keyword_rank) for hit in hits[:3]) / min(3, len(hits))
        vector = max(0.0, 1.0 - (hits[0].vector_distance or 1.0))
        return min(1.0, 0.5 * coverage + 0.3 * agreement + 0.2 * vector)

    def documents(self) -> list[dict]:
        indexed = {item["source"]: item for item in self.retriever.documents()}
        try:
            pages = load_documents(self.docs_dir)
        except IngestionError:
            return list(indexed.values())
        result = []
        for source in sorted({page.source for page in pages}):
            matching = [page for page in pages if page.source == source]
            result.append(
                {
                    "source": source,
                    "pages": len(matching),
                    "chunks": indexed.get(source, {}).get("chunks", 0),
                    "characters": sum(len(page.text) for page in matching),
                }
            )
        return result

    def create_quiz(self, topic: str = "", count: int = 5) -> list[dict[str, Any]]:
        query = topic.strip() or "key facts concepts policies details"
        hits = self.retriever.search(query, top_k=max(count * 2, 8))
        cards = []
        seen = set()
        for hit in hits:
            sentence = next((s.strip() for s in hit.chunk.text.split(".") if len(tokenize(s)) >= 5), "")
            terms = [term for term, _ in Counter(tokenize(sentence)).most_common() if len(term) >= 4]
            if not sentence or not terms:
                continue
            answer = terms[0]
            question = sentence.replace(answer, "_____", 1)
            key = question.casefold()
            if key in seen:
                continue
            seen.add(key)
            cards.append(
                {
                    "id": uuid.uuid5(uuid.NAMESPACE_URL, f"{hit.chunk.id}:{question}").hex[:16],
                    "question": f"Fill in the grounded fact: {question}",
                    "answer": answer,
                    "context": sentence,
                    "citation": hit.chunk.citation,
                }
            )
            if len(cards) == count:
                break
        return cards

    def review(self, card: dict[str, Any], rating: int) -> dict[str, Any]:
        if rating not in range(4):
            raise ValueError("rating must be 0 (again) through 3 (easy)")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        now = int(time.time())
        intervals = [0, 1, 3, 7]
        interval = intervals[rating]
        due = now + interval * 86400 if rating else now + 600
        with sqlite3.connect(self.retriever.sqlite_path) as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS reviews (card_id TEXT PRIMARY KEY, card_json TEXT, rating INTEGER, interval_days INTEGER, due_at INTEGER, reviewed_at INTEGER)"
            )
            db.execute(
                "INSERT OR REPLACE INTO reviews VALUES (?, ?, ?, ?, ?, ?)",
                (card["id"], json.dumps(card), rating, interval, due, now),
            )
        return {"card_id": card["id"], "rating": rating, "interval_days": interval, "due_at": due}

    def graph(self, limit: int = 60) -> dict[str, Any]:
        docs = self.retriever.documents()
        nodes = [{"id": f"doc:{d['source']}", "label": d["source"], "type": "document"} for d in docs]
        links = []
        with self.retriever._db() as db:
            rows = db.execute("SELECT id, source, page, text FROM chunks LIMIT ?", (limit,)).fetchall()
        term_counts = Counter(term for row in rows for term in set(tokenize(row["text"])) if len(term) > 5)
        concepts = {term for term, count in term_counts.most_common(24) if count >= 1}
        nodes.extend({"id": f"term:{term}", "label": term, "type": "concept"} for term in sorted(concepts))
        for row in rows:
            for term in concepts & set(tokenize(row["text"])):
                links.append({"source": f"doc:{row['source']}", "target": f"term:{term}", "page": row["page"]})
        return {"nodes": nodes, "links": links}
