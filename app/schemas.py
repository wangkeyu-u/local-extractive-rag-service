from typing import Any

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str
    top_k: int = Field(5, ge=1, le=20)
    session_id: str | None = None


class QuizRequest(BaseModel):
    topic: str = ""
    count: int = Field(5, ge=1, le=20)


class ReviewRequest(BaseModel):
    card: dict[str, Any]
    rating: int = Field(ge=0, le=3)
