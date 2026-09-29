#!/usr/bin/env python
"""Generate the resume evidence ledger from code and computed evaluation artifacts."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).parents[1]
EVAL_PATH = ROOT / "artifacts" / "evaluation" / "benchmark-results.json"
OUTPUT_JSON = ROOT / "docs" / "resume-evidence.json"
OUTPUT_MD = ROOT / "docs" / "RESUME_EVIDENCE.md"
RESUME_PATH = Path("/Users/wangkeyu/Downloads/123简历.pdf")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


evaluation = json.loads(EVAL_PATH.read_text(encoding="utf-8"))
metrics = evaluation["metrics"]
entries = [
    {
        "id": "rag-1-document-knowledge-base",
        "resume_text": "设计并开发了一款本地优先的RAG学习助手，可将非结构化文档（PDF、Markdown、文本）转化为高可搜索性、带引用且支持交互的个人知识库。",
        "status": "verified",
        "evidence_summary": "PDF page extraction, structured Markdown sections, plain text ingestion, persistent search, page/section citations, FastAPI and React interaction are implemented and tested.",
        "code_locations": [
            "app/ingestion.py::load_documents,parse_markdown,build_chunks",
            "app/models.py::PageDocument,Chunk,SearchHit",
            "app/main.py::POST /index,POST /ask",
            "frontend/src/App.jsx",
        ],
        "verification_commands": [
            ".venv/bin/python -m pytest -q tests/test_rag.py -k 'pdf or markdown or vertical_slice'",
            "RAG_API_URL=http://127.0.0.1:18765 ./scripts/demo.sh",
        ],
        "generated_artifacts": ["docs/sample_handbook.pdf", "artifacts/evaluation/benchmark-results.json"],
    },
    {
        "id": "rag-2-hybrid-retrieval",
        "resume_text": "通过使用ChromaDB向量搜索、SQLite FTS5关键词检索及RRF排序，实现了一套混合检索流程。",
        "status": "verified",
        "evidence_summary": "ChromaDB cosine retrieval and SQLite FTS5/BM25 are independently ranked and fused with RRF(k=60); Chroma failures are explicit with no fallback.",
        "code_locations": ["app/retrieval.py::HybridRetriever", "app/embeddings.py::DeterministicHashEmbedding"],
        "verification_commands": [
            ".venv/bin/python -m pytest -q tests/test_rag.py -k 'hybrid or chroma'",
            ".venv/bin/python scripts/evaluate.py",
        ],
        "generated_artifacts": ["artifacts/evaluation/benchmark-results.json"],
    },
    {
        "id": "rag-3-advanced-grounding",
        "resume_text": "通过引入高级RAG技术（包括查询重写、确定性多跳查询分解、置信度门控及严格的句子级引用验证），有效缓解了幻觉问题，并增强了事实依据。",
        "status": "verified",
        "evidence_summary": "The deterministic provider rewrites and decomposes queries, the service confidence-gates answers, and the independent verifier removes uncited, wrong-page, or non-evidence sentences. This verifies mechanisms, not a general hallucination-reduction percentage.",
        "code_locations": [
            "app/providers.py::DeterministicProvider",
            "app/service.py::RagService.ask,RagService._confidence",
            "app/grounding.py::verify_answer",
        ],
        "verification_commands": [
            ".venv/bin/python -m pytest -q tests/test_rag.py -k 'rewrite or multi_hop or confidence or tampered or uncited'",
            ".venv/bin/python scripts/evaluate.py",
        ],
        "generated_artifacts": ["artifacts/evaluation/benchmark-results.json", "artifacts/evaluation/benchmark-results.md"],
    },
    {
        "id": "rag-4-learning-workflow",
        "resume_text": "开发了交互式学习工作流，支持多轮对话、自动测验生成、间隔重复系统、无缝Anki导出，以及基于D3.js的动态知识图谱可视化。",
        "status": "verified",
        "evidence_summary": "Session follow-ups, grounded quiz cards, persisted review intervals, valid Anki .apkg generation, and a local D3 force graph are exercised by integration tests.",
        "code_locations": [
            "app/service.py::RagService.ask,create_quiz,review,graph",
            "app/main.py::POST /quiz,POST /review,GET /anki,GET /graph",
            "app/static/graph.html",
        ],
        "verification_commands": [".venv/bin/python -m pytest -q tests/test_rag.py -k 'multi_turn or quiz or anki or graph'"],
        "generated_artifacts": ["app/static/d3.min.js", "app/static/graph.html"],
    },
    {
        "id": "rag-5-perfect-benchmark",
        "resume_text": "建立了严格的离线评估质量门控，涵盖检索、多跳召回及引用覆盖率，并在混合检索基线上实现了完美的基准指标。",
        "status": "unsupported",
        "evidence_summary": (
            "The offline gate is implemented and all computed metrics are 1.0, but only on a synthetic curated fixture "
            f"({evaluation['samples']['single_hop']} single-hop, {evaluation['samples']['multi_hop']} multi-hop, "
            f"{evaluation['samples']['unanswerable']} unanswerable). There is no separate baseline comparison and the resume text omits this scope, so the broad 'perfect benchmark' claim is unsupported."
        ),
        "computed_fixture_metrics": metrics,
        "code_locations": ["app/evaluation.py::evaluate", "benchmark/ground_truth.json", "tests/test_evaluation.py"],
        "verification_commands": ["make eval", ".venv/bin/python -m pytest -q tests/test_evaluation.py"],
        "generated_artifacts": ["artifacts/evaluation/benchmark-results.json", "artifacts/evaluation/benchmark-results.md"],
    },
]

ledger = {
    "schema_version": 1,
    "resume_source": {
        "path": str(RESUME_PATH),
        "sha256": sha256(RESUME_PATH),
        "page_count": len(PdfReader(RESUME_PATH).pages),
    },
    "git": {
        "original_baseline": "a62ab5738031547343343ba8c3c22f7398441414",
        "round1_head": "735d0ebd27817d48e4662d6a3646ecb19130a9e0",
        "round1_tag": "codex/round1-complete",
        "round2_start_commit": git("rev-parse", "codex/round1-complete^{}"),
    },
    "data_and_model": evaluation["versions"],
    "benchmark": {
        "id": evaluation["benchmark_id"],
        "fixture": True,
        "scope": evaluation["scope"],
        "samples": evaluation["samples"],
        "metrics": metrics,
        "gate_passed": evaluation["gate_passed"],
        "artifact_sha256": sha256(EVAL_PATH),
    },
    "entries": entries,
}
OUTPUT_JSON.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

sections = []
for entry in entries:
    metric_block = ""
    if entry.get("computed_fixture_metrics"):
        metric_block = "\nComputed fixture metrics:\n\n" + "\n".join(
            f"- `{name}` = `{value:.6f}`" for name, value in entry["computed_fixture_metrics"].items()
        ) + "\n"
    sections.append(
        f"""## {entry['id']}

> {entry['resume_text']}

**Status:** `{entry['status']}`

{entry['evidence_summary']}
{metric_block}
Code locations:

{chr(10).join(f"- `{path}`" for path in entry['code_locations'])}

Recompute / test:

{chr(10).join(f"- `{command}`" for command in entry['verification_commands'])}

Artifacts:

{chr(10).join(f"- `{artifact}`" for artifact in entry['generated_artifacts'])}
"""
    )

OUTPUT_MD.write_text(
    f"""# Resume evidence ledger

This ledger maps the five RAG project claims from the supplied resume to reproducible repository evidence. Status values are restricted to `verified`, `implemented_unverified`, or `unsupported`.

## Scope warning

The benchmark is a **synthetic curated fixture**, not production traffic. It contains {evaluation['samples']['single_hop']} single-hop, {evaluation['samples']['multi_hop']} multi-hop, and {evaluation['samples']['unanswerable']} unanswerable questions. Its 1.0 metrics cannot be extrapolated. The broad resume phrase “完美的基准指标” remains `unsupported` because no separate hybrid-retrieval baseline comparison exists and the resume omits fixture scope.

Data/model provenance:

- Corpus SHA-256: `{evaluation['versions']['corpus_sha256']}`
- Ground truth SHA-256: `{evaluation['versions']['ground_truth_sha256']}`
- Embedding: `{evaluation['versions']['embedding']}`
- Embedding implementation SHA-256: `{evaluation['versions']['embedding_implementation_sha256']}`
- ChromaDB: `{evaluation['versions']['chromadb']}`
- SQLite: `{evaluation['versions']['sqlite']}`
- Python: `{evaluation['versions']['python']}`
- Machine-readable ledger: `docs/resume-evidence.json`

{"".join(sections)}
""",
    encoding="utf-8",
)
print(OUTPUT_JSON)
print(OUTPUT_MD)
