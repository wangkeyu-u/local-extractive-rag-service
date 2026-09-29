from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from .ingestion import IngestionError
from .retrieval import RetrievalError
from .schemas import AskRequest, QuizRequest, ReviewRequest
from .service import RagService


def create_app(docs_dir: Path | None = None, data_dir: Path | None = None) -> FastAPI:
    service = RagService(
        docs_dir or Path(os.getenv("RAG_DOCS_DIR", "docs")),
        data_dir or Path(os.getenv("RAG_DATA_DIR", ".rag_data")),
    )
    app = FastAPI(
        title="Local Hybrid RAG Learning Lab",
        description="PDF-aware local RAG with ChromaDB, SQLite FTS5, RRF, citations, and study tools.",
        version="2.0.0",
    )
    app.state.rag = service
    app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def call(operation):
        try:
            return operation()
        except (IngestionError, RetrievalError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/")
    def info() -> dict[str, Any]:
        return {
            "service": app.title,
            "version": app.version,
            "endpoints": ["POST /index", "POST /ask", "GET /documents", "POST /quiz", "POST /review", "GET /anki", "GET /graph", "GET /graph/view"],
        }

    @app.post("/index")
    def index() -> dict[str, Any]:
        return call(service.index)

    @app.get("/health")
    def health() -> dict[str, Any]:
        return service.health()

    @app.get("/documents")
    def documents() -> dict[str, Any]:
        return {"documents": service.documents()}

    @app.post("/ask")
    def ask(request: AskRequest) -> dict[str, Any]:
        return call(lambda: service.ask(request.question, request.top_k, request.session_id))

    @app.post("/quiz")
    def quiz(request: QuizRequest) -> dict[str, Any]:
        return {"cards": call(lambda: service.create_quiz(request.topic, request.count))}

    @app.post("/review")
    def review(request: ReviewRequest) -> dict[str, Any]:
        return call(lambda: service.review(request.card, request.rating))

    @app.get("/anki")
    def anki(topic: str = "", count: int = 10) -> Response:
        cards = call(lambda: service.create_quiz(topic, max(1, min(count, 50))))
        try:
            import genanki
            model = genanki.Model(
                1607392319,
                "Grounded Local RAG",
                fields=[{"name": "Question"}, {"name": "Answer"}, {"name": "Citation"}],
                templates=[{"name": "Grounded recall", "qfmt": "{{Question}}", "afmt": "{{FrontSide}}<hr>{{Answer}}<br><small>{{Citation}}</small>"}],
            )
            deck = genanki.Deck(2059400110, "Local RAG grounded review")
            for card in cards:
                deck.add_note(genanki.Note(model=model, fields=[card["question"], card["answer"], card["citation"]], guid=card["id"]))
            with tempfile.NamedTemporaryFile(suffix=".apkg") as file:
                genanki.Package(deck).write_to_file(file.name)
                payload = Path(file.name).read_bytes()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Anki export failed: {exc}") from exc
        return Response(payload, media_type="application/octet-stream", headers={"Content-Disposition": 'attachment; filename="local-rag.apkg"'})

    @app.get("/graph")
    def graph() -> dict[str, Any]:
        return call(service.graph)

    @app.get("/graph/view", response_class=HTMLResponse)
    def graph_view() -> str:
        return (Path(__file__).parent / "static" / "graph.html").read_text(encoding="utf-8")

    return app


app = create_app()
