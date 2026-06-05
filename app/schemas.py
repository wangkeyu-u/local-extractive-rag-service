from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(..., examples=["What is the refund policy?"])
    top_k: int = Field(3, ge=1, le=10)


class SourceChunk(BaseModel):
    source: str
    chunk_id: int
    score: float
    text: str


class IndexResponse(BaseModel):
    status: str
    documents_indexed: int
    chunks_indexed: int
    sources: list[str]


class AskResponse(BaseModel):
    answer: str
    chunks: list[SourceChunk]
    sources: list[SourceChunk]


class DocumentInfo(BaseModel):
    source: str
    characters: int
    words: int


class DocumentsResponse(BaseModel):
    documents: list[DocumentInfo]


class HealthResponse(BaseModel):
    status: str
    index_ready: bool
    chunks_indexed: int
