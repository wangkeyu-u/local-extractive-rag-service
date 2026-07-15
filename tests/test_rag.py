from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import rag
from app.main import app


@pytest.fixture(autouse=True)
def reset_index():
    rag.rag_index.clear()
    yield
    rag.rag_index.clear()


@pytest.fixture
def client():
    return TestClient(app)


def write_docs(base_path: Path, files: dict[str, str]) -> None:
    docs_dir = base_path / "docs"
    docs_dir.mkdir()
    for filename, text in files.items():
        (docs_dir / filename).write_text(text, encoding="utf-8")


def write_sample_docs(base_path: Path) -> None:
    write_docs(
        base_path,
        {
            "product_overview.txt": (
                "AquaNote is a fictional smart note-taking product for students and remote teams. "
                "It helps users capture meeting notes and organize class summaries."
            ),
            "refund_policy.txt": (
                "Customers can request a refund within 30 days of purchase. "
                "Refunds are returned to the original payment method after review."
            ),
            "shipping_policy.txt": (
                "Standard shipping takes 3 to 5 business days after processing. "
                "Express shipping takes 1 to 2 business days after processing."
            ),
            "privacy_policy.txt": (
                "AquaNote does not sell customer data to advertisers or data brokers. "
                "Customer notes are private by default."
            ),
            "support_policy.txt": (
                "AquaNote support is available by email Monday through Friday. "
                "Most requests receive a first response within one business day."
            ),
        },
    )


def test_chunking_creates_overlapping_chunks():
    text = " ".join(f"word{i}" for i in range(450))

    chunks = rag.chunk_text(text, chunk_size=200, overlap=40)

    assert len(chunks) == 3
    assert len(chunks[0].split()) == 200
    assert chunks[0].split()[-40:] == chunks[1].split()[:40]
    assert chunks[1].split()[-40:] == chunks[2].split()[:40]


def test_indexing_works_with_sample_docs(tmp_path, monkeypatch):
    write_sample_docs(tmp_path)
    monkeypatch.chdir(tmp_path)

    response = rag.build_index()

    assert response["status"] == "indexed"
    assert response["documents_indexed"] == 5
    assert response["chunks_indexed"] == 5
    assert response["sources"] == [
        "privacy_policy.txt",
        "product_overview.txt",
        "refund_policy.txt",
        "shipping_policy.txt",
        "support_policy.txt",
    ]
    assert response["chunk_size"] == rag.CHUNK_SIZE_WORDS
    assert response["chunk_overlap"] == rag.CHUNK_OVERLAP_WORDS
    assert response["indexed_at"]
    assert rag.rag_index.is_ready


def test_document_listing_returns_doc_metadata(tmp_path, monkeypatch, client):
    write_sample_docs(tmp_path)
    monkeypatch.chdir(tmp_path)

    response = client.get("/documents")
    body = response.json()

    assert response.status_code == 200
    assert len(body["documents"]) == 5
    assert body["documents"][0]["source"] == "privacy_policy.txt"
    assert body["documents"][0]["words"] > 0
    assert body["documents"][0]["chunks"] == 1


def test_health_reports_index_state(tmp_path, monkeypatch, client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "index_ready": False,
        "chunks_indexed": 0,
        "documents_indexed": 0,
        "indexed_at": None,
    }

    write_sample_docs(tmp_path)
    monkeypatch.chdir(tmp_path)
    client.post("/index")

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["index_ready"] is True
    assert response.json()["chunks_indexed"] == 5
    assert response.json()["documents_indexed"] == 5
    assert response.json()["indexed_at"]


def test_root_lists_service_endpoints(client):
    response = client.get("/")
    body = response.json()

    assert response.status_code == 200
    assert body["service"] == "Local Extractive RAG API Service"
    assert body["endpoints"]["index"] == "POST /index"
    assert body["endpoints"]["ask"] == "POST /ask"


def test_asking_before_index_raises_error(client):
    response = client.post("/ask", json={"question": "What is the refund policy?", "top_k": 1})

    assert response.status_code == 400
    assert response.json() == {"detail": "no index found"}


def test_empty_question_raises_error(tmp_path, monkeypatch, client):
    write_sample_docs(tmp_path)
    monkeypatch.chdir(tmp_path)
    client.post("/index")

    response = client.post("/ask", json={"question": "   "})

    assert response.status_code == 400
    assert response.json() == {"detail": "empty question"}


def test_relevant_question_returns_at_least_one_source(tmp_path, monkeypatch, client):
    write_sample_docs(tmp_path)
    monkeypatch.chdir(tmp_path)
    client.post("/index")

    response = client.post("/ask", json={"question": "What is the refund policy?"})
    body = response.json()

    assert response.status_code == 200
    assert "refund" in body["answer"].lower()
    assert len(body["chunks"]) >= 1
    assert body["chunks"][0]["source"] == "refund_policy.txt"
    assert len(body["sources"]) >= 1
    assert body["sources"][0]["source"] == "refund_policy.txt"
    assert body["sources"][0]["rank"] == 1
    assert "refund" in body["sources"][0]["matched_terms"]
    assert body["confidence"] in {"low", "medium", "high"}
    assert body["retrieval_ms"] >= 0
    assert "refund" in body["query_terms"]
    assert "[1]" in body["answer"]


def test_top_k_validation_returns_422(tmp_path, monkeypatch, client):
    write_sample_docs(tmp_path)
    monkeypatch.chdir(tmp_path)
    client.post("/index")

    response = client.post("/ask", json={"question": "What is the refund policy?", "top_k": 99})

    assert response.status_code == 422


def test_unrelated_question_returns_not_enough_evidence(tmp_path, monkeypatch, client):
    write_sample_docs(tmp_path)
    monkeypatch.chdir(tmp_path)
    client.post("/index")

    response = client.post("/ask", json={"question": "Who is the CEO of the company?"})

    assert response.status_code == 200
    assert response.json() == {
        "answer": rag.NOT_ENOUGH_EVIDENCE_ANSWER,
        "chunks": [],
        "sources": [],
        "confidence": "insufficient",
        "retrieval_ms": response.json()["retrieval_ms"],
        "query_terms": ["ceo", "company"],
    }


def test_missing_docs_folder_returns_clear_error(tmp_path, monkeypatch, client):
    monkeypatch.chdir(tmp_path)

    response = client.post("/index")

    assert response.status_code == 400
    assert response.json() == {"detail": "docs folder not found"}


def test_empty_docs_folder_returns_clear_error(tmp_path, monkeypatch, client):
    (tmp_path / "docs").mkdir()
    monkeypatch.chdir(tmp_path)

    response = client.post("/index")

    assert response.status_code == 400
    assert response.json() == {"detail": "no text documents found in docs folder"}


def test_empty_documents_return_clear_error(tmp_path, monkeypatch, client):
    write_docs(tmp_path, {"empty.txt": "   \n"})
    monkeypatch.chdir(tmp_path)

    response = client.post("/index")

    assert response.status_code == 400
    assert response.json() == {"detail": "documents are empty; no index can be built"}


def test_stop_word_only_documents_return_clear_error(tmp_path, monkeypatch, client):
    write_docs(tmp_path, {"words.txt": "the and is are to of"})
    monkeypatch.chdir(tmp_path)

    response = client.post("/index")

    assert response.status_code == 400
    assert response.json() == {
        "detail": "documents do not contain searchable text; no index can be built"
    }


def test_failed_reindex_clears_stale_index(tmp_path, monkeypatch, client):
    write_sample_docs(tmp_path)
    monkeypatch.chdir(tmp_path)
    client.post("/index")
    assert rag.rag_index.is_ready

    for doc_path in (tmp_path / "docs").glob("*.txt"):
        doc_path.unlink()

    response = client.post("/index")

    assert response.status_code == 400
    assert response.json() == {"detail": "no text documents found in docs folder"}
    assert not rag.rag_index.is_ready


def test_retrieval_ranks_exact_policy_terms_first(tmp_path, monkeypatch):
    write_sample_docs(tmp_path)
    monkeypatch.chdir(tmp_path)
    rag.build_index()

    results = rag.retrieve_chunks("standard shipping business days", top_k=3)

    assert results[0]["source"] == "shipping_policy.txt"
    assert results[0]["rank"] == 1
    assert {"shipping", "standard"}.issubset(results[0]["matched_terms"])


def test_confidence_label_has_clear_thresholds():
    assert rag.confidence_label(0.5) == "high"
    assert rag.confidence_label(0.2) == "medium"
    assert rag.confidence_label(rag.MIN_SCORE) == "low"
    assert rag.confidence_label(0.01) == "insufficient"
