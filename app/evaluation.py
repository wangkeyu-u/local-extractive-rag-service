from __future__ import annotations

import hashlib
import importlib.metadata
import json
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from .grounding import verify_answer
from .service import NOT_ENOUGH_EVIDENCE, RagService


BENCHMARK_VERSION = "local-rag-curated-fixture-v1"
GATE_THRESHOLDS = {
    "single_recall_at_5": 1.0,
    "rrf_mrr_at_5": 0.9,
    "multi_evidence_coverage_at_8": 1.0,
    "sentence_citation_coverage": 1.0,
    "sentence_citation_precision": 1.0,
    "abstention_accuracy": 1.0,
}


def corpus_hash(corpus_dir: Path) -> str:
    lines = []
    for path in sorted(p for p in corpus_dir.iterdir() if p.is_file()):
        lines.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  benchmark/corpus/{path.name}\n")
    return hashlib.sha256("".join(lines).encode()).hexdigest()


def locator_matches(result: dict, locator: dict) -> bool:
    return (
        result["source"] == locator["source"]
        and result["page"] == locator["page"]
        and (not locator.get("section") or result.get("section") == locator["section"])
    )


def evaluate(benchmark_dir: Path, data_dir: Path, output_dir: Path) -> dict[str, Any]:
    truth_path = benchmark_dir / "ground_truth.json"
    truth_bytes = truth_path.read_bytes()
    truth = json.loads(truth_bytes)
    actual_corpus_hash = corpus_hash(benchmark_dir / "corpus")
    if actual_corpus_hash != truth["corpus_sha256"]:
        raise ValueError(f"benchmark corpus hash mismatch: expected {truth['corpus_sha256']}, got {actual_corpus_hash}")

    if data_dir.exists():
        shutil.rmtree(data_dir)
    service = RagService(benchmark_dir / "corpus", data_dir)
    index_summary = service.index()

    single_details = []
    reciprocal_ranks = []
    for item in truth["single_hop"]:
        result = service.ask(item["question"], top_k=5)
        ranks = [rank for rank, hit in enumerate(result["results"], 1) if any(locator_matches(hit, locator) for locator in item["evidence"])]
        reciprocal = 1 / min(ranks) if ranks else 0.0
        reciprocal_ranks.append(reciprocal)
        single_details.append({"id": item["id"], "retrieved": bool(ranks), "first_relevant_rank": min(ranks) if ranks else None, "reciprocal_rank": reciprocal})

    multi_details = []
    multi_coverages = []
    for item in truth["multi_hop"]:
        result = service.ask(item["question"], top_k=8)
        found = [any(locator_matches(hit, locator) for hit in result["results"]) for locator in item["evidence"]]
        coverage = sum(found) / len(found)
        multi_coverages.append(coverage)
        multi_details.append({"id": item["id"], "evidence_found": found, "coverage": coverage})

    citation_results = [service.ask(item["question"], top_k=5) for item in truth["single_hop"]]
    verdicts = [verdict for result in citation_results for verdict in result["sentence_grounding"]]
    supported = sum(bool(verdict["supported"]) for verdict in verdicts)
    cited = sum(bool(verdict["citation"]) for verdict in verdicts)
    answer_sentences = len(verdicts)

    abstentions = []
    for item in truth["unanswerable"]:
        result = service.ask(item["question"], top_k=5)
        abstentions.append({"id": item["id"], "abstained": not result["grounded"] and result["answer"] == NOT_ENOUGH_EVIDENCE})

    metrics = {
        "single_recall_at_5": sum(item["retrieved"] for item in single_details) / len(single_details),
        "rrf_mrr_at_5": sum(reciprocal_ranks) / len(reciprocal_ranks),
        "multi_evidence_coverage_at_8": sum(multi_coverages) / len(multi_coverages),
        "sentence_citation_coverage": cited / answer_sentences if answer_sentences else 0.0,
        "sentence_citation_precision": supported / cited if cited else 0.0,
        "abstention_accuracy": sum(item["abstained"] for item in abstentions) / len(abstentions),
    }
    checks = {name: metrics[name] >= threshold for name, threshold in GATE_THRESHOLDS.items()}
    report = {
        "schema_version": 1,
        "benchmark_id": truth["benchmark_id"],
        "fixture": True,
        "scope": truth["scope"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "versions": {
            "corpus_sha256": actual_corpus_hash,
            "ground_truth_sha256": hashlib.sha256(truth_bytes).hexdigest(),
            "embedding": service.retriever.embedding.name(),
            "vector_store": "ChromaDB",
            "keyword_store": "SQLite FTS5",
            "fusion": "RRF(k=60)",
            "python": sys.version.split()[0],
            "chromadb": importlib.metadata.version("chromadb"),
            "pypdf": importlib.metadata.version("pypdf"),
            "sqlite": sqlite3.sqlite_version,
        },
        "samples": {"single_hop": len(single_details), "multi_hop": len(multi_details), "unanswerable": len(abstentions)},
        "index": index_summary,
        "metrics": metrics,
        "thresholds": GATE_THRESHOLDS,
        "checks": checks,
        "gate_passed": all(checks.values()),
        "details": {"single_hop": single_details, "multi_hop": multi_details, "unanswerable": abstentions},
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "benchmark-results.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (output_dir / "benchmark-results.md").write_text(render_markdown(report), encoding="utf-8")
    return report


def render_markdown(report: dict[str, Any]) -> str:
    rows = "\n".join(
        f"| `{name}` | {value:.6f} | {report['thresholds'][name]:.6f} | {'PASS' if report['checks'][name] else 'FAIL'} |"
        for name, value in report["metrics"].items()
    )
    return f"""# Offline benchmark results

> **CURATED FIXTURE ONLY.** {report['scope']} These metrics must not be extrapolated beyond this benchmark.

- Benchmark: `{report['benchmark_id']}`
- Samples: {report['samples']['single_hop']} single-hop, {report['samples']['multi_hop']} multi-hop, {report['samples']['unanswerable']} unanswerable
- Corpus SHA-256: `{report['versions']['corpus_sha256']}`
- Ground truth SHA-256: `{report['versions']['ground_truth_sha256']}`
- Embedding: `{report['versions']['embedding']}`
- Gate: **{'PASS' if report['gate_passed'] else 'FAIL'}**

| Metric | Actual | Threshold | Gate |
|---|---:|---:|---|
{rows}
"""
