import re
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


DOCS_DIR = Path("docs")
CHUNK_SIZE_WORDS = 200
CHUNK_OVERLAP_WORDS = 40
TOP_K = 3
MIN_SCORE = 0.12
SOURCE_NAME_PATTERN = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._-]*\.txt$",
    re.IGNORECASE,
)
NOT_ENOUGH_EVIDENCE_ANSWER = (
    "I do not have enough evidence in the provided documents to answer this question."
)

ANSWER_STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "can",
    "does",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "this",
    "to",
    "what",
    "when",
    "where",
    "who",
    "why",
}


class RagServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 400) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class InMemoryRagIndex:
    def __init__(self) -> None:
        self.vectorizer: TfidfVectorizer | None = None
        self.matrix: Any | None = None
        self.chunks: list[dict[str, Any]] = []
        self.document_count = 0
        self.indexed_at: str | None = None
        self.chunk_size = CHUNK_SIZE_WORDS
        self.chunk_overlap = CHUNK_OVERLAP_WORDS

    @property
    def is_ready(self) -> bool:
        return self.vectorizer is not None and self.matrix is not None and bool(self.chunks)

    def clear(self) -> None:
        self.vectorizer = None
        self.matrix = None
        self.chunks = []
        self.document_count = 0
        self.indexed_at = None
        self.chunk_size = CHUNK_SIZE_WORDS
        self.chunk_overlap = CHUNK_OVERLAP_WORDS


rag_index = InMemoryRagIndex()


def load_documents(docs_dir: Path = DOCS_DIR) -> list[tuple[str, str]]:
    if not docs_dir.exists():
        raise RagServiceError("docs folder not found")

    if not docs_dir.is_dir():
        raise RagServiceError("docs path is not a folder")

    text_files = sorted(docs_dir.glob("*.txt"))
    if not text_files:
        raise RagServiceError("no text documents found in docs folder")

    documents: list[tuple[str, str]] = []
    for file_path in text_files:
        text = file_path.read_text(encoding="utf-8").strip()
        if text:
            documents.append((file_path.name, text))

    if not documents:
        raise RagServiceError("documents are empty; no index can be built")

    return documents


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE_WORDS,
    overlap: int = CHUNK_OVERLAP_WORDS,
) -> list[str]:
    words = text.split()
    if not words:
        return []

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be greater than or equal to 0 and smaller than chunk_size")

    chunks: list[str] = []
    start = 0

    while start < len(words):
        end = start + chunk_size
        chunks.append(" ".join(words[start:end]))
        if end >= len(words):
            break
        start = end - overlap

    return chunks


def build_chunks(
    documents: list[tuple[str, str]],
    chunk_size: int = CHUNK_SIZE_WORDS,
    overlap: int = CHUNK_OVERLAP_WORDS,
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []

    for source, text in documents:
        for chunk_id, chunk in enumerate(
            chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        ):
            chunks.append(
                {
                    "source": source,
                    "chunk_id": chunk_id,
                    "text": chunk,
                }
            )

    if not chunks:
        raise RagServiceError("documents are empty; no index can be built")

    return chunks


def build_index(
    docs_dir: Path = DOCS_DIR,
    chunk_size: int = CHUNK_SIZE_WORDS,
    overlap: int = CHUNK_OVERLAP_WORDS,
) -> dict[str, Any]:
    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise RagServiceError("invalid chunk settings")

    rag_index.clear()

    documents = load_documents(docs_dir)
    chunks = build_chunks(documents, chunk_size=chunk_size, overlap=overlap)
    chunk_texts = [chunk["text"] for chunk in chunks]

    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        strip_accents="unicode",
        sublinear_tf=True,
    )
    try:
        matrix = vectorizer.fit_transform(chunk_texts)
    except ValueError as exc:
        rag_index.clear()
        raise RagServiceError("documents do not contain searchable text; no index can be built") from exc

    rag_index.vectorizer = vectorizer
    rag_index.matrix = matrix
    rag_index.chunks = chunks
    rag_index.document_count = len(documents)
    rag_index.indexed_at = datetime.now(UTC).isoformat()
    rag_index.chunk_size = chunk_size
    rag_index.chunk_overlap = overlap

    return {
        "status": "indexed",
        "documents_indexed": len(documents),
        "chunks_indexed": len(chunks),
        "sources": [source for source, _ in documents],
        "chunk_size": chunk_size,
        "chunk_overlap": overlap,
        "indexed_at": rag_index.indexed_at,
    }


def retrieve_chunks(question: str, top_k: int = TOP_K) -> list[dict[str, Any]]:
    if not rag_index.is_ready:
        raise RagServiceError("no index found")

    assert rag_index.vectorizer is not None
    assert rag_index.matrix is not None

    query_vector = rag_index.vectorizer.transform([question])
    scores = cosine_similarity(query_vector, rag_index.matrix)[0]
    ranked_indexes = scores.argsort()[::-1][:top_k]

    question_tokens = tokenize(question)
    results: list[dict[str, Any]] = []
    for rank, chunk_index in enumerate(ranked_indexes, start=1):
        chunk = rag_index.chunks[int(chunk_index)]
        matched_terms = sorted(question_tokens & tokenize(chunk["text"]))
        results.append(
            {
                "source": chunk["source"],
                "chunk_id": chunk["chunk_id"],
                "score": round(float(scores[chunk_index]), 4),
                "text": chunk["text"],
                "rank": rank,
                "matched_terms": matched_terms,
            }
        )

    return results


def tokenize(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9]+", text.lower())
        if token not in ANSWER_STOP_WORDS
    }


def split_sentences(text: str) -> list[str]:
    return [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text.replace("\n", " "))
        if sentence.strip()
    ]


def select_relevant_sentences(
    question: str,
    sources: list[dict[str, Any]],
    limit: int = TOP_K,
) -> list[tuple[str, int]]:
    question_tokens = tokenize(question)
    scored_sentences: list[tuple[int, int, int, str]] = []

    for source_rank, source in enumerate(sources):
        for sentence_rank, sentence in enumerate(split_sentences(source["text"])):
            overlap = len(question_tokens & tokenize(sentence))
            scored_sentences.append((overlap, -source_rank, -sentence_rank, sentence))

    scored_sentences.sort(reverse=True)

    selected: list[tuple[str, int]] = []
    for overlap, negative_source_rank, _, sentence in scored_sentences:
        if overlap == 0 and selected:
            break
        source_rank = -negative_source_rank
        if all(existing_sentence != sentence for existing_sentence, _ in selected):
            selected.append((sentence, source_rank))
        if len(selected) == limit:
            break

    if selected:
        return selected

    return [(sources[0]["text"], 0)] if sources else []


def generate_extractive_answer(question: str, sources: list[dict[str, Any]]) -> str:
    sentences = select_relevant_sentences(question, sources)
    if not sentences:
        return NOT_ENOUGH_EVIDENCE_ANSWER
    return " ".join(
        f"{sentence} [{source_rank + 1}]" for sentence, source_rank in sentences
    )


def _validate_docs_dir(docs_dir: Path) -> None:
    if not docs_dir.exists():
        raise RagServiceError("docs folder not found")
    if not docs_dir.is_dir():
        raise RagServiceError("docs path is not a folder")


def _safe_document_path(source: str, docs_dir: Path = DOCS_DIR) -> Path:
    if not SOURCE_NAME_PATTERN.fullmatch(source):
        raise RagServiceError(
            "source must be a plain .txt filename using letters, numbers, dots, dashes, or underscores",
            status_code=422,
        )
    return docs_dir / source


def list_document_info(docs_dir: Path = DOCS_DIR) -> list[dict[str, int | str]]:
    _validate_docs_dir(docs_dir)
    chunk_size = rag_index.chunk_size if rag_index.is_ready else CHUNK_SIZE_WORDS
    overlap = rag_index.chunk_overlap if rag_index.is_ready else CHUNK_OVERLAP_WORDS
    documents: list[dict[str, int | str]] = []

    for path in sorted(docs_dir.glob("*.txt")):
        text = path.read_text(encoding="utf-8").strip()
        documents.append(
            {
                "source": path.name,
                "characters": len(text),
                "words": len(text.split()),
                "chunks": len(
                    chunk_text(text, chunk_size=chunk_size, overlap=overlap)
                ),
                "updated_at": datetime.fromtimestamp(
                    path.stat().st_mtime, UTC
                ).isoformat(),
            }
        )

    return documents


def get_document(source: str, docs_dir: Path = DOCS_DIR) -> dict[str, int | str]:
    _validate_docs_dir(docs_dir)
    path = _safe_document_path(source, docs_dir)
    if not path.exists():
        raise RagServiceError("document not found", status_code=404)

    text = path.read_text(encoding="utf-8").strip()
    chunk_size = rag_index.chunk_size if rag_index.is_ready else CHUNK_SIZE_WORDS
    overlap = rag_index.chunk_overlap if rag_index.is_ready else CHUNK_OVERLAP_WORDS
    return {
        "source": path.name,
        "text": text,
        "characters": len(text),
        "words": len(text.split()),
        "chunks": len(chunk_text(text, chunk_size=chunk_size, overlap=overlap)),
        "updated_at": datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat(),
    }


def _active_chunk_settings() -> tuple[int, int]:
    if rag_index.is_ready:
        return rag_index.chunk_size, rag_index.chunk_overlap
    return CHUNK_SIZE_WORDS, CHUNK_OVERLAP_WORDS


def save_document(
    source: str,
    text: str,
    replace: bool = False,
    reindex: bool = True,
    docs_dir: Path = DOCS_DIR,
) -> dict[str, Any]:
    docs_dir.mkdir(parents=True, exist_ok=True)
    path = _safe_document_path(source, docs_dir)
    existed = path.exists()
    if existed and not replace:
        raise RagServiceError("document already exists", status_code=409)

    clean_text = text.strip()
    if not clean_text:
        raise RagServiceError("document text must not be empty", status_code=422)

    temporary_path = path.with_suffix(".txt.tmp")
    temporary_path.write_text(f"{clean_text}\n", encoding="utf-8")
    temporary_path.replace(path)

    if reindex:
        chunk_size, overlap = _active_chunk_settings()
        build_index(docs_dir, chunk_size=chunk_size, overlap=overlap)

    health = get_health()
    return {
        "status": "updated" if existed else "created",
        "source": source,
        "index_ready": health["index_ready"],
        "documents_indexed": health["documents_indexed"],
        "chunks_indexed": health["chunks_indexed"],
    }


def delete_document(
    source: str,
    reindex: bool = True,
    docs_dir: Path = DOCS_DIR,
) -> dict[str, Any]:
    _validate_docs_dir(docs_dir)
    path = _safe_document_path(source, docs_dir)
    if not path.exists():
        raise RagServiceError("document not found", status_code=404)

    chunk_size, overlap = _active_chunk_settings()
    path.unlink()

    if reindex:
        if any(docs_dir.glob("*.txt")):
            try:
                build_index(docs_dir, chunk_size=chunk_size, overlap=overlap)
            except RagServiceError as exc:
                if exc.detail not in {
                    "documents are empty; no index can be built",
                    "documents do not contain searchable text; no index can be built",
                }:
                    raise
                rag_index.clear()
        else:
            rag_index.clear()

    health = get_health()
    return {
        "status": "deleted",
        "source": source,
        "index_ready": health["index_ready"],
        "documents_indexed": health["documents_indexed"],
        "chunks_indexed": health["chunks_indexed"],
    }


def get_health() -> dict[str, bool | int | float | str | None]:
    return {
        "status": "ok",
        "index_ready": rag_index.is_ready,
        "chunks_indexed": len(rag_index.chunks),
        "documents_indexed": rag_index.document_count,
        "indexed_at": rag_index.indexed_at,
        "chunk_size": rag_index.chunk_size,
        "chunk_overlap": rag_index.chunk_overlap,
        "min_score": MIN_SCORE,
        "retrieval_method": "tfidf-cosine",
    }


def confidence_label(score: float) -> str:
    if score >= 0.3:
        return "high"
    if score >= 0.16:
        return "medium"
    if score >= MIN_SCORE:
        return "low"
    return "insufficient"


def answer_question(question: str, top_k: int = TOP_K) -> dict[str, Any]:
    clean_question = question.strip()
    if not clean_question:
        raise RagServiceError("empty question")

    started_at = perf_counter()
    sources = retrieve_chunks(clean_question, top_k=top_k)
    retrieval_ms = round((perf_counter() - started_at) * 1000, 2)
    query_terms = sorted(tokenize(clean_question))
    if not sources or sources[0]["score"] < MIN_SCORE:
        return {
            "answer": NOT_ENOUGH_EVIDENCE_ANSWER,
            "chunks": [],
            "sources": [],
            "confidence": "insufficient",
            "retrieval_ms": retrieval_ms,
            "query_terms": query_terms,
        }

    strong_sources = [source for source in sources if source["score"] >= MIN_SCORE]
    return {
        "answer": generate_extractive_answer(clean_question, strong_sources),
        "chunks": strong_sources,
        "sources": strong_sources,
        "confidence": confidence_label(strong_sources[0]["score"]),
        "retrieval_ms": retrieval_ms,
        "query_terms": query_terms,
    }
