from __future__ import annotations

import hashlib
import re
from pathlib import Path

from pypdf import PdfReader

from .models import Chunk, PageDocument


SUPPORTED_SUFFIXES = {".pdf", ".txt"}


class IngestionError(ValueError):
    pass


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def load_documents(docs_dir: Path) -> list[PageDocument]:
    if not docs_dir.exists():
        raise IngestionError(f"documents directory not found: {docs_dir}")
    paths = sorted(path for path in docs_dir.iterdir() if path.suffix.lower() in SUPPORTED_SUFFIXES)
    if not paths:
        raise IngestionError("no .pdf or .txt documents found")

    pages: list[PageDocument] = []
    for path in paths:
        if path.suffix.lower() == ".pdf":
            try:
                reader = PdfReader(path)
                extracted = [normalize_text(page.extract_text() or "") for page in reader.pages]
            except Exception as exc:
                raise IngestionError(f"failed to parse PDF {path.name}: {exc}") from exc
            for number, text in enumerate(extracted, start=1):
                if text:
                    pages.append(PageDocument(path.name, number, text, str(path)))
        else:
            text = normalize_text(path.read_text(encoding="utf-8"))
            if text:
                pages.append(PageDocument(path.name, 1, text, str(path)))
    if not pages:
        raise IngestionError("documents contain no extractable text")
    return pages


def chunk_page(page: PageDocument, chunk_size: int = 180, overlap: int = 30) -> list[Chunk]:
    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("chunk_size must be positive and overlap must be in [0, chunk_size)")
    words = page.text.split()
    chunks: list[Chunk] = []
    start = 0
    chunk_id = 0
    while start < len(words):
        text = " ".join(words[start : start + chunk_size])
        identity = f"{page.source}:{page.page}:{chunk_id}:{text}".encode()
        chunks.append(
            Chunk(
                id=hashlib.sha256(identity).hexdigest()[:24],
                source=page.source,
                page=page.page,
                chunk_id=chunk_id,
                text=text,
                path=page.path,
            )
        )
        if start + chunk_size >= len(words):
            break
        start += chunk_size - overlap
        chunk_id += 1
    return chunks


def build_chunks(pages: list[PageDocument], chunk_size: int = 180, overlap: int = 30) -> list[Chunk]:
    chunks = [chunk for page in pages for chunk in chunk_page(page, chunk_size, overlap)]
    if not chunks:
        raise IngestionError("documents produced no chunks")
    return chunks
