# Local Extractive RAG API Service

Small local RAG software for answering questions from plain-text documents in `docs/`.

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
- Add Docker support.
