# Local Extractive RAG API — 本地抽取式 RAG 服务 / Local-Only Extractive RAG

> 纯本地、不调用任何外部 LLM API 的抽取式 RAG —— TF-IDF 检索、证据锚定、只从文档中回答。
>
> Local-only extractive RAG that never calls external LLM APIs — TF-IDF retrieval, evidence-grounded, answers only from matched source chunks.

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688)](https://fastapi.tiangolo.com/)
[![scikit-learn](https://img.shields.io/badge/ML-scikit--learn-F7931E)](https://scikit-learn.org/)
[![Local Only](https://img.shields.io/badge/Local%20Only-No%20LLM%20API-success)]()

---

## 项目简介（中文）

纯本地运行的抽取式 RAG API 服务，用于文本文档问答。它构建内存中的 TF-IDF 检索索引，从匹配的文档片段中生成抽取式回答，**不调用 OpenAI、Anthropic、DeepSeek、Gemini 或任何外部 LLM API**。证据不足时返回"证据不足"的安全回答而非编造。包含 React/Vite 前端用于本地 UI 测试。核心端点：`POST /index` 索引文档、`POST /ask` 提问并返回带来源、分数和文本的证据片段。

---

# Local Extractive RAG API Service

![Local Extractive RAG Service hero](docs/assets/readme-hero.png)

Local-only extractive RAG for plain-text documents. It indexes files, retrieves evidence, and answers only from matched source chunks without calling external LLM APIs.

**Built for:** FastAPI document Q&A, TF-IDF retrieval, grounded answers, evidence chunks, private local demos.

The backend is a FastAPI service that builds an in-memory TF-IDF retrieval index and returns extractive answers grounded only in retrieved document evidence. It does not call OpenAI, Anthropic, DeepSeek, Gemini, external LLM APIs, or paid external services.

The project also includes a React/Vite frontend for testing the API through a polished local UI.

## Requirement Coverage

- `POST /index` reads all non-empty `.txt` files from `docs/`.
- Documents are split into retrieval chunks.
- The retrieval index is stored in memory at runtime.
- `POST /ask` retrieves relevant chunks for a question.
- Answers are generated only from retrieved document text.
- Successful answers return evidence chunks with `source`, `chunk_id`, `score`, and `text`.
- Weak or missing evidence returns an insufficient-evidence answer instead of guessing.
- Common error cases return clear messages.
- The app runs locally with FastAPI, scikit-learn, React, and Vite.

## Tech Stack

- Python 3.10+
- FastAPI
- scikit-learn TF-IDF
- pytest
- React
- Vite
- Docker

## Project Structure

```txt
.
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── rag.py
│   └── schemas.py
├── docs/
│   ├── privacy_policy.txt
│   ├── product_overview.txt
│   ├── refund_policy.txt
│   ├── shipping_policy.txt
│   └── support_policy.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── tests/
├── .env.example
├── Dockerfile
├── Makefile
├── requirements.txt
└── README.md
```

## Environment

Copy the example env files if you want local overrides:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Default local URLs:

```txt
Backend:  http://127.0.0.1:8000
Frontend: http://127.0.0.1:5173
```

## Backend Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the backend:

```bash
uvicorn app:app --reload
```

Alternative:

```bash
uvicorn app.main:app --reload
```

Open FastAPI docs:

```txt
http://127.0.0.1:8000/docs
```

Convenience command:

```bash
make run
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open the UI:

```txt
http://127.0.0.1:5173
```

The frontend uses Vite proxying, so `/api/index`, `/api/ask`, `/api/documents`, and `/api/health` forward to `http://127.0.0.1:8000`.

## API Examples

Service info:

```bash
curl http://127.0.0.1:8000/
```

Index documents:

```bash
curl -X POST http://127.0.0.1:8000/index
```

Example response:

```json
{
  "status": "indexed",
  "documents_indexed": 5,
  "chunks_indexed": 5,
  "sources": [
    "privacy_policy.txt",
    "product_overview.txt",
    "refund_policy.txt",
    "shipping_policy.txt",
    "support_policy.txt"
  ]
}
```

Ask a question:

```bash
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the refund policy?", "top_k": 3}'
```

Example response:

```json
{
  "answer": "Customers can request a refund within 30 days of purchase.",
  "chunks": [
    {
      "source": "refund_policy.txt",
      "chunk_id": 0,
      "score": 0.2719,
      "text": "Customers can request a refund within 30 days of purchase..."
    }
  ],
  "sources": [
    {
      "source": "refund_policy.txt",
      "chunk_id": 0,
      "score": 0.2719,
      "text": "Customers can request a refund within 30 days of purchase..."
    }
  ]
}
```

Weak evidence response:

```json
{
  "answer": "I do not have enough evidence in the provided documents to answer this question.",
  "chunks": [],
  "sources": []
}
```

List documents:

```bash
curl http://127.0.0.1:8000/documents
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

## Error Behavior

- Ask before indexing: `no index found`
- Empty question: `empty question`
- Missing `docs/` folder: `docs folder not found`
- Empty `docs/` folder: `no text documents found in docs folder`
- Empty documents: `documents are empty; no index can be built`
- Documents with no searchable terms: `documents do not contain searchable text; no index can be built`
- Weak evidence: returns the insufficient-evidence answer with no chunks

## Test

Backend tests:

```bash
pytest -q
```

Or:

```bash
make test
```

Frontend production build:

```bash
cd frontend
npm run build
```

Manual smoke test:

```bash
curl -X POST http://127.0.0.1:8000/index
curl -X POST http://127.0.0.1:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Does the company sell customer data?", "top_k": 3}'
```

## Docker

Build and run the backend container:

```bash
docker build -t local-extractive-rag-service .
docker run --rm -p 8000:8000 local-extractive-rag-service
```

Then open:

```txt
http://127.0.0.1:8000/docs
```

## Tradeoffs

- TF-IDF is simple, local, and explainable, but weaker than semantic embeddings.
- Extractive answering is safer than generative answering, but responses may sound less natural.
- The index is in memory, so it must be rebuilt after server restart.
- The similarity threshold is intentionally simple and may need tuning for larger corpora.
- The frontend is for local testing and demonstration, not production deployment.

## Future Improvements

- Add persistent vector storage.
- Add local embeddings for better semantic matching.
- Add document upload and reindexing from the frontend.
- Add sentence-level highlighting inside evidence cards.
- Add GitHub Actions CI when the GitHub token has `workflow` scope.
- Add a hosted demo environment.
