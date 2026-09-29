# Resume evidence ledger

This ledger maps the five RAG project claims from the supplied resume to reproducible repository evidence. Status values are restricted to `verified`, `implemented_unverified`, or `unsupported`.

## Scope warning

The benchmark is a **synthetic curated fixture**, not production traffic. It contains 12 single-hop, 6 multi-hop, and 3 unanswerable questions. Its 1.0 metrics cannot be extrapolated. The broad resume phrase “完美的基准指标” remains `unsupported` because no separate hybrid-retrieval baseline comparison exists and the resume omits fixture scope.

Data/model provenance:

- Corpus SHA-256: `f2df4e34c663f7f47f0562b788d333ebe2f0fb58b77de12ad06bae87140693a2`
- Ground truth SHA-256: `c5f1f56688b3be23b96af20947ff13f0e7f849fe6d22ed0efad9169b100c50dd`
- Embedding: `deterministic-hash-v1-384`
- Embedding implementation SHA-256: `f3fdfed83cd3d76cf7c4129f2596d2fadeec2f4caa50aaf388f98f770b5886e8`
- ChromaDB: `1.5.9`
- SQLite: `3.53.1`
- Python: `3.12.13`
- Machine-readable ledger: `docs/resume-evidence.json`

## rag-1-document-knowledge-base

> 设计并开发了一款本地优先的RAG学习助手，可将非结构化文档（PDF、Markdown、文本）转化为高可搜索性、带引用且支持交互的个人知识库。

**Status:** `verified`

PDF page extraction, structured Markdown sections, plain text ingestion, persistent search, page/section citations, FastAPI and React interaction are implemented and tested.

Code locations:

- `app/ingestion.py::load_documents,parse_markdown,build_chunks`
- `app/models.py::PageDocument,Chunk,SearchHit`
- `app/main.py::POST /index,POST /ask`
- `frontend/src/App.jsx`

Recompute / test:

- `.venv/bin/python -m pytest -q tests/test_rag.py -k 'pdf or markdown or vertical_slice'`
- `RAG_API_URL=http://127.0.0.1:18765 ./scripts/demo.sh`

Artifacts:

- `docs/sample_handbook.pdf`
- `artifacts/evaluation/benchmark-results.json`
## rag-2-hybrid-retrieval

> 通过使用ChromaDB向量搜索、SQLite FTS5关键词检索及RRF排序，实现了一套混合检索流程。

**Status:** `verified`

ChromaDB cosine retrieval and SQLite FTS5/BM25 are independently ranked and fused with RRF(k=60); Chroma failures are explicit with no fallback.

Code locations:

- `app/retrieval.py::HybridRetriever`
- `app/embeddings.py::DeterministicHashEmbedding`

Recompute / test:

- `.venv/bin/python -m pytest -q tests/test_rag.py -k 'hybrid or chroma'`
- `.venv/bin/python scripts/evaluate.py`

Artifacts:

- `artifacts/evaluation/benchmark-results.json`
## rag-3-advanced-grounding

> 通过引入高级RAG技术（包括查询重写、确定性多跳查询分解、置信度门控及严格的句子级引用验证），有效缓解了幻觉问题，并增强了事实依据。

**Status:** `verified`

The deterministic provider rewrites and decomposes queries, the service confidence-gates answers, and the independent verifier removes uncited, wrong-page, or non-evidence sentences. This verifies mechanisms, not a general hallucination-reduction percentage.

Code locations:

- `app/providers.py::DeterministicProvider`
- `app/service.py::RagService.ask,RagService._confidence`
- `app/grounding.py::verify_answer`

Recompute / test:

- `.venv/bin/python -m pytest -q tests/test_rag.py -k 'rewrite or multi_hop or confidence or tampered or uncited'`
- `.venv/bin/python scripts/evaluate.py`

Artifacts:

- `artifacts/evaluation/benchmark-results.json`
- `artifacts/evaluation/benchmark-results.md`
## rag-4-learning-workflow

> 开发了交互式学习工作流，支持多轮对话、自动测验生成、间隔重复系统、无缝Anki导出，以及基于D3.js的动态知识图谱可视化。

**Status:** `verified`

Session follow-ups, grounded quiz cards, persisted review intervals, valid Anki .apkg generation, and a local D3 force graph are exercised by integration tests.

Code locations:

- `app/service.py::RagService.ask,create_quiz,review,graph`
- `app/main.py::POST /quiz,POST /review,GET /anki,GET /graph`
- `app/static/graph.html`

Recompute / test:

- `.venv/bin/python -m pytest -q tests/test_rag.py -k 'multi_turn or quiz or anki or graph'`

Artifacts:

- `app/static/d3.min.js`
- `app/static/graph.html`
## rag-5-perfect-benchmark

> 建立了严格的离线评估质量门控，涵盖检索、多跳召回及引用覆盖率，并在混合检索基线上实现了完美的基准指标。

**Status:** `unsupported`

The offline gate is implemented and all computed metrics are 1.0, but only on a synthetic curated fixture (12 single-hop, 6 multi-hop, 3 unanswerable). There is no separate baseline comparison and the resume text omits this scope, so the broad 'perfect benchmark' claim is unsupported.

Computed fixture metrics:

- `single_recall_at_5` = `1.000000`
- `rrf_mrr_at_5` = `1.000000`
- `multi_evidence_coverage_at_8` = `1.000000`
- `sentence_citation_coverage` = `1.000000`
- `sentence_citation_precision` = `1.000000`
- `abstention_accuracy` = `1.000000`

Code locations:

- `app/evaluation.py::evaluate`
- `benchmark/ground_truth.json`
- `tests/test_evaluation.py`

Recompute / test:

- `make eval`
- `.venv/bin/python -m pytest -q tests/test_evaluation.py`

Artifacts:

- `artifacts/evaluation/benchmark-results.json`
- `artifacts/evaluation/benchmark-results.md`

