import builtins
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from app.embeddings import DeterministicHashEmbedding
from app.grounding import verify_answer
from app.ingestion import PageDocument, build_chunks, chunk_page, load_documents, parse_markdown
from app.main import create_app
from app.providers import DeterministicProvider
from app.retrieval import HybridRetriever, RetrievalError
from app.service import NOT_ENOUGH_EVIDENCE, RagService
from scripts.generate_sample_pdf import PAGES, build_pdf


@pytest.fixture
def corpus(tmp_path: Path) -> tuple[Path, Path]:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "handbook.pdf").write_bytes(build_pdf(PAGES))
    (docs / "support.txt").write_text(
        "Support is available Monday through Friday. Most requests receive a response within one business day.",
        encoding="utf-8",
    )
    return docs, tmp_path / "data"


@pytest.fixture
def service(corpus) -> RagService:
    docs, data = corpus
    instance = RagService(docs, data)
    instance.index()
    return instance


@pytest.fixture
def client(corpus) -> TestClient:
    docs, data = corpus
    return TestClient(create_app(docs, data))


def test_generated_pdf_has_two_extractable_pages():
    import io
    reader = PdfReader(io.BytesIO(build_pdf(PAGES)))
    assert len(reader.pages) == 2
    assert "30 days" in reader.pages[0].extract_text()
    assert "private" in reader.pages[1].extract_text()


def test_pdf_ingestion_and_chunking_preserve_page_metadata(corpus):
    docs, _ = corpus
    pages = load_documents(docs)
    chunks = build_chunks(pages, chunk_size=8, overlap=2)
    pdf_chunks = [chunk for chunk in chunks if chunk.source == "handbook.pdf"]
    assert {chunk.page for chunk in pdf_chunks} == {1, 2}
    assert all(chunk.citation.startswith("handbook.pdf p. ") for chunk in pdf_chunks)
    assert pdf_chunks[0].text.split()[-2:] == pdf_chunks[1].text.split()[:2]


def test_markdown_preserves_heading_hierarchy_lists_and_code(tmp_path):
    path = tmp_path / "guide.md"
    path.write_text(
        "# Operations\nIntro.\n## Backup\n- Keep 14 snapshots\n- Verify locally\n```bash\naurora backup verify\n```\n## Restore\nUse the recovery key.",
        encoding="utf-8",
    )
    sections = parse_markdown(path)
    assert [section.section for section in sections] == ["Operations", "Operations > Backup", "Operations > Restore"]
    assert "- Keep 14 snapshots" in sections[1].text
    assert "```bash\naurora backup verify\n```" in sections[1].text
    chunks = build_chunks(sections)
    assert chunks[1].section == "Operations > Backup"
    assert chunks[1].content_type == "markdown"


def test_hash_embedding_is_deterministic_normalized_and_not_fitted():
    embedding = DeterministicHashEmbedding(64)
    first = embedding.embed("refund within thirty days")
    assert first == embedding.embed("refund within thirty days")
    assert sum(value * value for value in first) == pytest.approx(1.0)
    assert embedding.name() == "deterministic-hash-v1-64"


def test_chroma_failure_is_explicit_and_has_no_fallback(tmp_path, monkeypatch):
    retriever = HybridRetriever(tmp_path / "data")
    real_import = builtins.__import__

    def fail_chroma(name, *args, **kwargs):
        if name == "chromadb":
            raise ImportError("unavailable for test")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fail_chroma)
    with pytest.raises(RetrievalError, match="ChromaDB unavailable.*no fallback"):
        retriever._load_chroma()


def test_hybrid_retrieval_explains_rrf_and_both_rankers(service):
    hit = service.retriever.search("refund within 30 days", top_k=1)[0]
    result = hit.as_dict()
    assert result["source"] == "handbook.pdf"
    assert result["page"] == 1
    assert result["explanation"]["vector_rank"] == 1
    assert result["explanation"]["keyword_rank"] == 1
    assert result["explanation"]["fusion"] == "reciprocal_rank_fusion(k=60)"


def test_query_rewrite_and_multi_hop_decomposition():
    provider = DeterministicProvider()
    history = [{"role": "user", "content": "What is the refund policy?"}]
    rewritten = provider.rewrite("How long does it last?", history)
    assert "previous question" in rewritten
    assert provider.decompose("Explain refunds and compare shipping") == ["Explain refunds", "compare shipping"]


def test_answer_is_reranked_confidence_gated_and_citation_grounded(service):
    result = service.ask("When can customers request a refund?", top_k=3)
    assert result["grounded"] is True
    assert result["confidence"] >= 0.34
    assert result["citations"] == ["handbook.pdf p. 1"]
    assert "[handbook.pdf p. 1]" in result["answer"]
    assert result["results"][0]["rerank_score"] > result["results"][0]["score"]
    assert result["sentence_grounding"]
    assert all(verdict["supported"] for verdict in result["sentence_grounding"])


def test_tampered_answer_sentence_and_wrong_page_are_removed(service):
    hits = service.retriever.search("refund within 30 days", top_k=3)
    tampered = (
        "Customers may request a refund within 30 days of purchase. [handbook.pdf p. 1] "
        "Refunds arrive instantly. [handbook.pdf p. 1] "
        "Customer notes are private by default. [handbook.pdf p. 1]"
    )
    cleaned, verdicts = verify_answer(tampered, hits)
    assert "within 30 days" in cleaned
    assert "instantly" not in cleaned and "private by default" not in cleaned
    assert [verdict.supported for verdict in verdicts] == [True, False, False]
    assert verdicts[1].reason == "sentence_not_in_cited_chunk"


def test_uncited_answer_is_fully_rejected(service):
    hits = service.retriever.search("refund", top_k=2)
    cleaned, verdicts = verify_answer("Refunds arrive instantly.", hits)
    assert cleaned == ""
    assert verdicts[0].reason == "missing_sentence_citation"


def test_low_confidence_query_refuses_to_answer(service):
    result = service.ask("Who won the lunar chess championship?", top_k=3)
    assert result["grounded"] is False
    assert result["answer"] == NOT_ENOUGH_EVIDENCE
    assert result["citations"] == []


def test_multi_turn_session_rewrites_follow_up(service):
    first = service.ask("What is the refund policy?")
    second = service.ask("How long does it last?", session_id=first["session_id"])
    assert first["session_id"] == second["session_id"]
    assert "What is the refund policy?" in second["rewritten_query"]


def test_multi_hop_question_retrieves_both_topics(service):
    result = service.ask("Explain refunds and compare shipping", top_k=5)
    texts = " ".join(item["text"].casefold() for item in result["results"])
    assert "refund" in texts and "shipping" in texts
    assert len(result["subqueries"]) == 2
    assert any("refund" in citation.casefold() or citation == "handbook.pdf p. 1" for citation in result["citations"])


def test_quiz_review_and_graph(service):
    card = service.create_quiz("refund", count=1)[0]
    assert card["citation"] == "handbook.pdf p. 1"
    review = service.review(card, rating=2)
    assert review["interval_days"] == 3
    graph = service.graph()
    assert any(node["type"] == "document" for node in graph["nodes"])
    assert any(link["page"] == 1 for link in graph["links"])


def test_api_vertical_slice_and_real_anki_package(client, tmp_path):
    indexed = client.post("/index")
    assert indexed.status_code == 200
    assert indexed.json()["stores"] == {"vector": "ChromaDB", "keyword": "SQLite FTS5"}

    answer = client.post("/ask", json={"question": "Are customer notes private?", "top_k": 3})
    assert answer.status_code == 200
    assert answer.json()["grounded"] is True
    assert answer.json()["results"][0]["page"] == 2

    package = client.get("/anki?topic=refund&count=1")
    assert package.status_code == 200
    target = tmp_path / "deck.apkg"
    target.write_bytes(package.content)
    assert zipfile.is_zipfile(target)
    with zipfile.ZipFile(target) as archive:
        assert "collection.anki2" in archive.namelist()

    graph = client.get("/graph")
    view = client.get("/graph/view")
    assert graph.status_code == 200 and graph.json()["nodes"]
    assert view.status_code == 200 and "d3.min.js" in view.text


def test_api_before_index_is_clear(client):
    response = client.post("/ask", json={"question": "What is the refund policy?"})
    assert response.status_code == 400
    assert "run POST /index first" in response.json()["detail"]
