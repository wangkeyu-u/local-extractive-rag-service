from __future__ import annotations

import re
import sqlite3
from pathlib import Path

from .embeddings import DeterministicHashEmbedding
from .models import Chunk, SearchHit


class RetrievalError(RuntimeError):
    pass


def tokenize(text: str) -> list[str]:
    return [token for token in re.findall(r"[\w]+", text.casefold(), flags=re.UNICODE) if len(token) > 1]


class HybridRetriever:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.sqlite_path = data_dir / "rag.sqlite3"
        self.chroma_path = data_dir / "chroma"
        self.embedding = DeterministicHashEmbedding()
        self._client = None
        self._collection = None

    def _load_chroma(self):
        try:
            import chromadb
        except Exception as exc:
            raise RetrievalError(
                "ChromaDB unavailable: install a compatible Python (3.10-3.13) and `pip install -r requirements.txt`; no fallback was used"
            ) from exc
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(path=str(self.chroma_path))
            self._collection = self._client.get_or_create_collection(
                "local_rag_chunks", metadata={"hnsw:space": "cosine"}
            )
            return self._collection
        except Exception as exc:
            raise RetrievalError(f"ChromaDB unavailable: {exc}; no fallback was used") from exc

    def _db(self) -> sqlite3.Connection:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.sqlite_path)
        connection.row_factory = sqlite3.Row
        return connection

    def index(self, chunks: list[Chunk]) -> None:
        collection = self._load_chroma()
        try:
            existing = collection.get(include=[])["ids"]
            if existing:
                collection.delete(ids=existing)
            collection.add(
                ids=[chunk.id for chunk in chunks],
                documents=[chunk.text for chunk in chunks],
                embeddings=[self.embedding.embed(chunk.text) for chunk in chunks],
                metadatas=[
                    {"source": chunk.source, "page": chunk.page, "chunk_id": chunk.chunk_id, "path": chunk.path}
                    for chunk in chunks
                ],
            )
        except Exception as exc:
            raise RetrievalError(f"ChromaDB indexing failed: {exc}; no fallback was used") from exc

        with self._db() as db:
            db.execute("DROP TABLE IF EXISTS chunks_fts")
            db.execute("DROP TABLE IF EXISTS chunks")
            db.execute(
                "CREATE TABLE chunks (id TEXT PRIMARY KEY, source TEXT, page INTEGER, chunk_id INTEGER, text TEXT, path TEXT)"
            )
            try:
                db.execute("CREATE VIRTUAL TABLE chunks_fts USING fts5(id UNINDEXED, text, tokenize='porter unicode61')")
            except sqlite3.OperationalError as exc:
                raise RetrievalError(f"SQLite FTS5 unavailable: {exc}") from exc
            rows = [(c.id, c.source, c.page, c.chunk_id, c.text, c.path) for c in chunks]
            db.executemany("INSERT INTO chunks VALUES (?, ?, ?, ?, ?, ?)", rows)
            db.executemany("INSERT INTO chunks_fts(id, text) VALUES (?, ?)", [(c.id, c.text) for c in chunks])

    @property
    def is_ready(self) -> bool:
        if not self.sqlite_path.exists():
            return False
        try:
            collection = self._load_chroma()
            with self._db() as db:
                count = db.execute("SELECT count(*) FROM chunks").fetchone()[0]
            return count > 0 and collection.count() == count
        except Exception:
            return False

    def count(self) -> int:
        if not self.sqlite_path.exists():
            return 0
        try:
            with self._db() as db:
                return int(db.execute("SELECT count(*) FROM chunks").fetchone()[0])
        except sqlite3.Error:
            return 0

    def _chunk(self, row) -> Chunk:
        return Chunk(row["id"], row["source"], row["page"], row["chunk_id"], row["text"], row["path"])

    def _chunks_by_ids(self, ids: list[str]) -> dict[str, Chunk]:
        if not ids:
            return {}
        marks = ",".join("?" for _ in ids)
        with self._db() as db:
            rows = db.execute(f"SELECT * FROM chunks WHERE id IN ({marks})", ids).fetchall()
        return {row["id"]: self._chunk(row) for row in rows}

    def search(self, query: str, top_k: int = 5, candidate_k: int | None = None) -> list[SearchHit]:
        if not self.sqlite_path.exists():
            raise RetrievalError("no hybrid index found; run POST /index first")
        candidate_k = candidate_k or max(top_k * 3, 10)
        collection = self._load_chroma()
        with self._db() as db:
            sqlite_count = int(db.execute("SELECT count(*) FROM chunks").fetchone()[0])
        if sqlite_count == 0 or collection.count() != sqlite_count:
            raise RetrievalError("hybrid index is incomplete; run POST /index to rebuild both stores")
        try:
            vector = collection.query(
                query_embeddings=[self.embedding.embed(query)],
                n_results=min(candidate_k, collection.count()),
                include=["distances"],
            )
        except Exception as exc:
            raise RetrievalError(f"ChromaDB query failed: {exc}; no fallback was used") from exc
        vector_ids = vector["ids"][0]
        vector_distances = vector["distances"][0]

        terms = list(dict.fromkeys(tokenize(query)))
        keyword_rows = []
        if terms:
            fts_query = " OR ".join(f'"{term.replace(chr(34), chr(34) * 2)}"' for term in terms)
            with self._db() as db:
                keyword_rows = db.execute(
                    "SELECT id, bm25(chunks_fts) AS rank FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?",
                    (fts_query, candidate_k),
                ).fetchall()

        all_ids = list(dict.fromkeys(vector_ids + [row["id"] for row in keyword_rows]))
        chunks = self._chunks_by_ids(all_ids)
        hits = {chunk_id: SearchHit(chunk=chunks[chunk_id]) for chunk_id in all_ids if chunk_id in chunks}
        for rank, (chunk_id, distance) in enumerate(zip(vector_ids, vector_distances), start=1):
            if chunk_id in hits:
                hits[chunk_id].vector_rank = rank
                hits[chunk_id].vector_distance = float(distance)
                hits[chunk_id].score += 1 / (60 + rank)
        for rank, row in enumerate(keyword_rows, start=1):
            if row["id"] in hits:
                hits[row["id"]].keyword_rank = rank
                hits[row["id"]].keyword_bm25 = float(row["rank"])
                hits[row["id"]].score += 1 / (60 + rank)
        query_terms = set(terms)
        for hit in hits.values():
            hit.matched_terms = sorted(query_terms & set(tokenize(hit.chunk.text)))
        return sorted(hits.values(), key=lambda hit: (-hit.score, hit.chunk.id))[:top_k]

    def documents(self) -> list[dict]:
        if not self.sqlite_path.exists():
            return []
        with self._db() as db:
            rows = db.execute(
                "SELECT source, count(DISTINCT page) pages, count(*) chunks, sum(length(text)) characters FROM chunks GROUP BY source ORDER BY source"
            ).fetchall()
        return [dict(row) for row in rows]
