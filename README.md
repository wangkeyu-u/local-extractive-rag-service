# Local Hybrid RAG Learning Lab

A local-first, runnable RAG vertical slice for PDF/text research and study. It parses page-level PDF text, persists vector search in **ChromaDB**, persists keyword search in **SQLite FTS5**, fuses both ranked lists with **Reciprocal Rank Fusion (RRF)**, and returns inspectable retrieval traces and page citations.

The default provider is deliberately deterministic and offline. It does not call an LLM or download an embedding model. The Chroma vectors are fixed-dimensional feature-hashing embeddings generated per text (not TF-IDF). If ChromaDB cannot import, initialize, index, or query, the request fails explicitly; there is no disguised retrieval fallback.

## Verified capabilities

- `.pdf` and `.txt` ingestion, overlapping chunks, source/page/chunk metadata
- persistent ChromaDB cosine vector retrieval and independent SQLite FTS5/BM25 retrieval
- RRF hybrid fusion with vector rank/distance, FTS rank/BM25, matched terms, and subquery trace
- deterministic provider abstraction for rewrite, multi-part query decomposition, reranking, extractive answers, confidence gating, and citation grounding
- bounded in-process multi-turn sessions with follow-up query rewriting
- grounded fill-in-the-blank quiz generation, persisted review schedules, and real Anki `.apkg` export
- local D3.js force-directed knowledge graph with document/concept links and page evidence
- generated two-page sample PDF, unit/integration/API tests, React/Vite evidence console

This repository does **not** claim benchmark gains, answer-quality improvements, OCR, table extraction, or production-grade authentication. Scanned PDFs without an extractable text layer are skipped as empty pages.

## Requirements and install

- Python 3.10–3.13 (tested here with Python 3.12)
- Node.js 20+ only for the optional React frontend
- a Python build whose SQLite includes FTS5

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Generate the sample PDF again if desired:

```bash
.venv/bin/python scripts/generate_sample_pdf.py
```

## Run the demo

Terminal 1:

```bash
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
./scripts/demo.sh
```

Useful pages:

- API docs: `http://127.0.0.1:8000/docs`
- D3 evidence graph: `http://127.0.0.1:8000/graph/view`

Optional frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the backend.

## API walkthrough

Index `docs/*.pdf` and `docs/*.txt`:

```bash
curl -sS -X POST http://127.0.0.1:8000/index
```

Ask a grounded question:

```bash
curl -sS -X POST http://127.0.0.1:8000/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"Explain refunds and compare shipping","top_k":5}'
```

The JSON includes `rewritten_query`, `subqueries`, `confidence`, `grounded`, `citations`, and per-result `explanation`. To continue a conversation, pass the returned `session_id` in the next `/ask` request.

Study endpoints:

```bash
curl -sS -X POST http://127.0.0.1:8000/quiz \
  -H 'Content-Type: application/json' \
  -d '{"topic":"refund","count":3}'

curl -OJ 'http://127.0.0.1:8000/anki?topic=refund&count=10'
```

`POST /review` accepts a returned card and `rating` from `0` (again) to `3` (easy), then persists its due time in `.rag_data/rag.sqlite3`.

## Test and build evidence

```bash
.venv/bin/python -m pytest -q
cd frontend && npm run build
```

The integration suite creates and parses a two-page PDF, exercises real ChromaDB and FTS5 stores, inspects RRF traces and citations, verifies the confidence refusal path and multi-turn rewrite, persists a review, loads graph data, and opens the generated `.apkg` as an Anki ZIP package.

## Architecture

```text
PDF/TXT -> page-aware chunks -> ChromaDB vector rank --\
                         \----> SQLite FTS5 rank ----- RRF -> multi-query merge
                                                               -> deterministic rerank
                                                               -> confidence gate
                                                               -> extractive answer + [file p. N]
                                                               -> quiz / review / Anki / graph
```

`RagProvider` is the seam for a future local or remote model provider. The included `DeterministicProvider` keeps CI and interview demos reproducible and offline.

Persistent runtime data is written under `.rag_data/` and is intentionally gitignored. Re-run `POST /index` after changing the corpus.

## ChromaDB failure behavior

ChromaDB is required. A missing/incompatible dependency produces a `400` response containing `ChromaDB unavailable ... no fallback was used`; indexing and asking do not substitute TF-IDF or vector-like keyword scoring. Use a supported Python and reinstall `requirements.txt`.

## Safety and rollback

Implementation branch: `codex/interview-alignment`

Original default branch: `main`

Original HEAD: `a62ab5738031547343343ba8c3c22f7398441414`

No push or force operation is part of this work. See [ROLLBACK.md](ROLLBACK.md) for inspect, file restore, and branch removal commands.
