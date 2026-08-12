from __future__ import annotations

import hashlib
import re
from pathlib import Path

from pypdf import PdfReader

from .models import Chunk, PageDocument


SUPPORTED_SUFFIXES = {".pdf", ".md", ".markdown", ".txt"}


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
        elif path.suffix.lower() in {".md", ".markdown"}:
            pages.extend(parse_markdown(path))
        else:
            text = normalize_text(path.read_text(encoding="utf-8"))
            if text:
                pages.append(PageDocument(path.name, 1, text, str(path), content_type="text"))
    if not pages:
        raise IngestionError("documents contain no extractable text")
    return pages


def parse_markdown(path: Path) -> list[PageDocument]:
    """Split Markdown by heading while preserving list and fenced-code content."""
    heading_stack: list[str] = []
    section_lines: list[str] = []
    sections: list[PageDocument] = []
    in_code = False

    def flush() -> None:
        text = "\n".join(section_lines).strip()
        if text:
            sections.append(
                PageDocument(
                    source=path.name,
                    page=1,
                    text=text,
                    path=str(path),
                    section=" > ".join(heading_stack),
                    content_type="markdown",
                )
            )
        section_lines.clear()

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_code = not in_code
            section_lines.append(raw_line)
            continue
        heading = None if in_code else re.match(r"^(#{1,6})\s+(.+?)\s*$", raw_line)
        if heading:
            flush()
            level = len(heading.group(1))
            heading_stack[level - 1 :] = [heading.group(2).strip()]
            section_lines.append(raw_line)
        else:
            section_lines.append(raw_line)
    flush()
    return sections


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
                section=page.section,
                content_type=page.content_type,
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
