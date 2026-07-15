from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(..., examples=["What is the refund policy?"])
    top_k: int = Field(3, ge=1, le=10)


class SourceChunk(BaseModel):
    source: str
    chunk_id: int
    score: float
    text: str
    rank: int
    matched_terms: list[str]


class IndexResponse(BaseModel):
    status: str
    documents_indexed: int
    chunks_indexed: int
    sources: list[str]
    chunk_size: int
    chunk_overlap: int
    indexed_at: str


class AskResponse(BaseModel):
    answer: str
    chunks: list[SourceChunk]
    sources: list[SourceChunk]
    confidence: str
    retrieval_ms: float
    query_terms: list[str]


class DocumentInfo(BaseModel):
    source: str
    characters: int
    words: int
    chunks: int


class DocumentsResponse(BaseModel):
    documents: list[DocumentInfo]


class HealthResponse(BaseModel):
    status: str
    index_ready: bool
    chunks_indexed: int
    documents_indexed: int
    indexed_at: str | None
