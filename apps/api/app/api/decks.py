from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.core.config import get_settings
from app.db import get_connection
from app.pdf import extract_pdf
from app.persistence import persist_slide_passages
from app.schemas.deck import DeckExtractionResponse
from app.storage import get_object_storage, materialize_file

router = APIRouter(tags=["decks"])


@router.post(
    "/sessions/{session_id}/extract-deck",
    response_model=DeckExtractionResponse,
)
def extract_session_deck(
    session_id: UUID,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> DeckExtractionResponse:
    row = connection.execute(
        "select lecture_pdf_path from public.sessions where id = %s",
        (session_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")

    lecture_pdf_path = row[0]
    if not lecture_pdf_path:
        raise HTTPException(status_code=400, detail="Session has no lecture PDF")

    settings = get_settings()
    pdf_path = materialize_file(
        settings.storage_dir,
        lecture_pdf_path,
        get_object_storage(settings),
    )
    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail="Lecture PDF file not found")

    slides = extract_pdf(Path(pdf_path))
    persist_slide_passages(connection, session_id, slides)
    return DeckExtractionResponse(
        session_id=str(session_id),
        slides=slides,
    )
