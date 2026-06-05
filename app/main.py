from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .rag import RagServiceError, answer_question, build_index, get_health, list_document_info
from .schemas import AskRequest, AskResponse, DocumentsResponse, HealthResponse, IndexResponse


app = FastAPI(
    title="Local Extractive RAG API Service",
    description="A local TF-IDF retrieval service that answers only from indexed text documents.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def convert_rag_error(error: RagServiceError) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=error.detail)


@app.post("/index", response_model=IndexResponse)
def index_documents() -> dict[str, Any]:
    try:
        return build_index()
    except RagServiceError as exc:
        raise convert_rag_error(exc) from exc


@app.get("/documents", response_model=DocumentsResponse)
def documents() -> dict[str, Any]:
    try:
        return {"documents": list_document_info()}
    except RagServiceError as exc:
        raise convert_rag_error(exc) from exc


@app.get("/health", response_model=HealthResponse)
def health() -> dict[str, Any]:
    return get_health()


@app.post("/ask", response_model=AskResponse)
def ask(request: AskRequest) -> dict[str, Any]:
    try:
        return answer_question(request.question, top_k=request.top_k)
    except RagServiceError as exc:
        raise convert_rag_error(exc) from exc
