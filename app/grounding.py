from __future__ import annotations

import re
from dataclasses import dataclass, asdict

from .models import SearchHit


CITED_SENTENCE = re.compile(
    r"(?P<sentence>.*?(?:[.!?。！？](?=\s*\[)|$))\s*\[(?P<citation>[^\[\]]+? p\. \d+)\](?=\s|$)",
    re.DOTALL,
)


def normalize_claim(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


@dataclass(frozen=True)
class SentenceVerdict:
    sentence: str
    citation: str | None
    supported: bool
    chunk_id: str | None
    reason: str

    def as_dict(self) -> dict:
        return asdict(self)


def verify_answer(answer: str, hits: list[SearchHit]) -> tuple[str, list[SentenceVerdict]]:
    """Keep only sentences exactly supported by the chunk named in their citation."""
    verdicts: list[SentenceVerdict] = []
    supported_segments: list[str] = []
    consumed: list[tuple[int, int]] = []
    by_citation: dict[str, list[SearchHit]] = {}
    for hit in hits:
        by_citation.setdefault(hit.chunk.citation, []).append(hit)

    for match in CITED_SENTENCE.finditer(answer.strip()):
        consumed.append(match.span())
        sentence = re.sub(r"\s+", " ", match.group("sentence")).strip()
        citation = match.group("citation").strip()
        evidence = by_citation.get(citation, [])
        supporting_hit = next(
            (hit for hit in evidence if normalize_claim(sentence) in normalize_claim(hit.chunk.text)),
            None,
        )
        if supporting_hit:
            verdicts.append(SentenceVerdict(sentence, citation, True, supporting_hit.chunk.id, "exact_sentence_in_cited_chunk"))
            supported_segments.append(f"{sentence} [{citation}]")
        else:
            reason = "citation_not_retrieved" if not evidence else "sentence_not_in_cited_chunk"
            verdicts.append(SentenceVerdict(sentence, citation, False, None, reason))

    cursor = 0
    for start, end in consumed:
        residue = answer[cursor:start].strip()
        if residue:
            verdicts.append(SentenceVerdict(residue, None, False, None, "missing_sentence_citation"))
        cursor = end
    residue = answer[cursor:].strip()
    if residue:
        verdicts.append(SentenceVerdict(residue, None, False, None, "missing_sentence_citation"))
    if answer.strip() and not consumed:
        verdicts = [SentenceVerdict(answer.strip(), None, False, None, "missing_sentence_citation")]
    return " ".join(supported_segments), verdicts
