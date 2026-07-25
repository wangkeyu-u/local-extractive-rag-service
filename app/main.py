from typing import Any

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from .rag import (
    RagServiceError,
    answer_question,
    build_index,
    delete_document,
    get_document,
    get_health,
    list_document_info,
    save_document,
)
from .schemas import (
    AskRequest,
    AskResponse,
    DocumentContentResponse,
    DocumentMutationResponse,
    DocumentsResponse,
    DocumentUpsertRequest,
    HealthResponse,
    IndexRequest,
    IndexResponse,
)


app = FastAPI(
    title="Local Extractive RAG API Service",
    description="A local TF-IDF retrieval service that answers only from indexed text documents.",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def convert_rag_error(error: RagServiceError) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=error.detail)


@app.get("/")
def service_info() -> dict[str, Any]:
    return {
        "service": app.title,
        "version": app.version,
        "endpoints": {
            "index": "POST /index",
            "ask": "POST /ask",
            "documents": "GET /documents",
            "document": "GET /documents/{source}",
            "add_document": "POST /documents",
            "delete_document": "DELETE /documents/{source}",
            "health": "GET /health",
            "docs": "GET /docs",
        },
    }


@app.post("/index", response_model=IndexResponse)
def index_documents(request: IndexRequest | None = None) -> dict[str, Any]:
    try:
        settings = request or IndexRequest()
        return build_index(
            chunk_size=settings.chunk_size,
            overlap=settings.chunk_overlap,
        )
    except RagServiceError as exc:
        raise convert_rag_error(exc) from exc


@app.get("/documents", response_model=DocumentsResponse)
def documents() -> dict[str, Any]:
    try:
        return {"documents": list_document_info()}
    except RagServiceError as exc:
        raise convert_rag_error(exc) from exc


@app.get("/documents/{source}", response_model=DocumentContentResponse)
def document(source: str) -> dict[str, Any]:
    try:
        return get_document(source)
    except RagServiceError as exc:
        raise convert_rag_error(exc) from exc


@app.post(
    "/documents",
    response_model=DocumentMutationResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_document(request: DocumentUpsertRequest) -> dict[str, Any]:
    try:
        return save_document(
            source=request.source,
            text=request.text,
            replace=request.replace,
            reindex=request.reindex,
        )
    except RagServiceError as exc:
        raise convert_rag_error(exc) from exc


@app.delete("/documents/{source}", response_model=DocumentMutationResponse)
def remove_document(
    source: str,
    reindex: bool = Query(True),
) -> dict[str, Any]:
    try:
        return delete_document(source, reindex=reindex)
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
