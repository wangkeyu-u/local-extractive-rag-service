import json
import shutil
from pathlib import Path

import pytest

from app.evaluation import corpus_hash, evaluate
from app.retrieval import HybridRetriever


ROOT = Path(__file__).parents[1]


def copy_benchmark(tmp_path: Path) -> Path:
    target = tmp_path / "benchmark"
    shutil.copytree(ROOT / "benchmark", target)
    return target


def test_benchmark_manifest_counts_and_hash_are_real():
    benchmark = json.loads((ROOT / "benchmark" / "ground_truth.json").read_text(encoding="utf-8"))
    assert benchmark["fixture"] is True
    assert len(benchmark["single_hop"]) >= 12
    assert len(benchmark["multi_hop"]) >= 6
    assert benchmark["corpus_sha256"] == corpus_hash(ROOT / "benchmark" / "corpus")
    serialized = (ROOT / "benchmark" / "ground_truth.json").read_text(encoding="utf-8")
    assert "chunk_id" not in serialized and '"answer"' not in serialized


def test_evaluation_gate_recomputes_metrics(tmp_path):
    report = evaluate(ROOT / "benchmark", tmp_path / "data", tmp_path / "out")
    assert report["fixture"] is True
    assert report["gate_passed"] is True
    assert all(report["checks"].values())
    saved = json.loads((tmp_path / "out" / "benchmark-results.json").read_text(encoding="utf-8"))
    assert saved["metrics"] == report["metrics"]


def test_tampered_corpus_is_rejected_by_hash(tmp_path):
    benchmark = copy_benchmark(tmp_path)
    with (benchmark / "corpus" / "science.txt").open("a", encoding="utf-8") as stream:
        stream.write(" Tampered input.")
    with pytest.raises(ValueError, match="corpus hash mismatch"):
        evaluate(benchmark, tmp_path / "data", tmp_path / "out")


def test_wrong_ground_truth_evidence_fails_gate(tmp_path):
    benchmark = copy_benchmark(tmp_path)
    truth_path = benchmark / "ground_truth.json"
    truth = json.loads(truth_path.read_text(encoding="utf-8"))
    truth["single_hop"][0]["evidence"] = [{"source": "missing.pdf", "page": 99, "section": ""}]
    truth_path.write_text(json.dumps(truth), encoding="utf-8")
    report = evaluate(benchmark, tmp_path / "data", tmp_path / "out")
    assert report["gate_passed"] is False
    assert report["metrics"]["single_recall_at_5"] < 1.0


def test_removed_retrieval_capability_fails_gate(tmp_path, monkeypatch):
    monkeypatch.setattr(HybridRetriever, "search", lambda self, query, top_k=5, candidate_k=None: [])
    report = evaluate(ROOT / "benchmark", tmp_path / "data", tmp_path / "out")
    assert report["gate_passed"] is False
    assert report["metrics"]["single_recall_at_5"] == 0.0
    assert report["metrics"]["multi_evidence_coverage_at_8"] == 0.0
