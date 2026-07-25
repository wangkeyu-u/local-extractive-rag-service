from pydantic import BaseModel, Field, model_validator


class AskRequest(BaseModel):
    question: str = Field(..., examples=["What is the refund policy?"])
    top_k: int = Field(3, ge=1, le=10)


class IndexRequest(BaseModel):
    chunk_size: int = Field(200, ge=20, le=2000)
    chunk_overlap: int = Field(40, ge=0, le=500)

    @model_validator(mode="after")
    def validate_overlap(self) -> "IndexRequest":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")
        return self


class DocumentUpsertRequest(BaseModel):
    source: str = Field(..., min_length=5, max_length=120)
    text: str = Field(..., min_length=1, max_length=1_000_000)
    replace: bool = False
    reindex: bool = True


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
    updated_at: str


class DocumentsResponse(BaseModel):
    documents: list[DocumentInfo]


class DocumentContentResponse(DocumentInfo):
    text: str


class DocumentMutationResponse(BaseModel):
    status: str
    source: str
    index_ready: bool
    documents_indexed: int
    chunks_indexed: int


class HealthResponse(BaseModel):
    status: str
    index_ready: bool
    chunks_indexed: int
    documents_indexed: int
    indexed_at: str | None
    chunk_size: int
    chunk_overlap: int
    min_score: float
    retrieval_method: str
