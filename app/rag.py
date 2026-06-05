import re
from pathlib import Path
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


DOCS_DIR = Path("docs")
CHUNK_SIZE_WORDS = 200
CHUNK_OVERLAP_WORDS = 40
TOP_K = 3
MIN_SCORE = 0.15
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

    @property
    def is_ready(self) -> bool:
        return self.vectorizer is not None and self.matrix is not None and bool(self.chunks)

    def clear(self) -> None:
        self.vectorizer = None
        self.matrix = None
        self.chunks = []


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


def build_chunks(documents: list[tuple[str, str]]) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []

    for source, text in documents:
        for chunk_id, chunk in enumerate(chunk_text(text)):
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


def build_index(docs_dir: Path = DOCS_DIR) -> dict[str, Any]:
    rag_index.clear()

    documents = load_documents(docs_dir)
    chunks = build_chunks(documents)
    chunk_texts = [chunk["text"] for chunk in chunks]

    vectorizer = TfidfVectorizer(stop_words="english")
    try:
        matrix = vectorizer.fit_transform(chunk_texts)
    except ValueError as exc:
        rag_index.clear()
        raise RagServiceError("documents do not contain searchable text; no index can be built") from exc

    rag_index.vectorizer = vectorizer
    rag_index.matrix = matrix
    rag_index.chunks = chunks

    return {
        "status": "indexed",
        "documents_indexed": len(documents),
        "chunks_indexed": len(chunks),
        "sources": [source for source, _ in documents],
    }


def retrieve_chunks(question: str, top_k: int = TOP_K) -> list[dict[str, Any]]:
    if not rag_index.is_ready:
        raise RagServiceError("no index found")

    assert rag_index.vectorizer is not None
    assert rag_index.matrix is not None

    query_vector = rag_index.vectorizer.transform([question])
    scores = cosine_similarity(query_vector, rag_index.matrix)[0]
    ranked_indexes = scores.argsort()[::-1][:top_k]

    results: list[dict[str, Any]] = []
    for chunk_index in ranked_indexes:
        chunk = rag_index.chunks[int(chunk_index)]
        results.append(
            {
                "source": chunk["source"],
                "chunk_id": chunk["chunk_id"],
                "score": round(float(scores[chunk_index]), 4),
                "text": chunk["text"],
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


def select_relevant_sentences(question: str, sources: list[dict[str, Any]], limit: int = TOP_K) -> list[str]:
    question_tokens = tokenize(question)
    scored_sentences: list[tuple[int, int, str]] = []

    for source_rank, source in enumerate(sources):
        for sentence in split_sentences(source["text"]):
            overlap = len(question_tokens & tokenize(sentence))
            scored_sentences.append((overlap, -source_rank, sentence))

    scored_sentences.sort(reverse=True)

    selected: list[str] = []
    for overlap, _, sentence in scored_sentences:
        if overlap == 0 and selected:
            break
        if sentence not in selected:
            selected.append(sentence)
        if len(selected) == limit:
            break

    if selected:
        return selected

    return [sources[0]["text"]] if sources else []


def generate_extractive_answer(question: str, sources: list[dict[str, Any]]) -> str:
    sentences = select_relevant_sentences(question, sources)
    if not sentences:
        return NOT_ENOUGH_EVIDENCE_ANSWER
    return " ".join(sentences)


def list_document_info(docs_dir: Path = DOCS_DIR) -> list[dict[str, int | str]]:
    documents = load_documents(docs_dir)
    return [
        {
            "source": source,
            "characters": len(text),
            "words": len(text.split()),
        }
        for source, text in documents
    ]


def get_health() -> dict[str, bool | int | str]:
    return {
        "status": "ok",
        "index_ready": rag_index.is_ready,
        "chunks_indexed": len(rag_index.chunks),
    }


def answer_question(question: str, top_k: int = TOP_K) -> dict[str, Any]:
    clean_question = question.strip()
    if not clean_question:
        raise RagServiceError("empty question")

    sources = retrieve_chunks(clean_question, top_k=top_k)
    if not sources or sources[0]["score"] < MIN_SCORE:
        return {
            "answer": NOT_ENOUGH_EVIDENCE_ANSWER,
            "chunks": [],
            "sources": [],
        }

    strong_sources = [source for source in sources if source["score"] >= MIN_SCORE]
    return {
        "answer": generate_extractive_answer(clean_question, strong_sources),
        "chunks": strong_sources,
        "sources": strong_sources,
    }
