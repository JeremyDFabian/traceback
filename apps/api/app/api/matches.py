from typing import Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.api.analysis import analysis_storage_key
from app.core.config import get_settings
from app.db import get_connection
from app.pdf import extract_pdf
from app.persistence import persist_match
from app.retrieval import match_region
from app.schemas.analysis import AnalysisResult
from app.schemas.match import MatchResponse
from app.storage import get_object_storage, load_json, materialize_file

router = APIRouter(tags=["matches"])


@router.post(
    "/sessions/{session_id}/regions/{region_id}/match",
    response_model=MatchResponse,
)
def match_session_region(
    session_id: UUID,
    region_id: str,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> MatchResponse:
    row = connection.execute(
        "select lecture_pdf_path from public.sessions where id = %s",
        (session_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if not row[0]:
        raise HTTPException(status_code=400, detail="Session has no lecture PDF")

    try:
        settings = get_settings()
        analysis = AnalysisResult.model_validate(
            load_json(
                settings.storage_dir,
                analysis_storage_key(session_id),
                get_object_storage(settings),
            )
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Analysis not found") from error

    region = next((item for item in analysis.regions if item.id == region_id), None)
    if region is None:
        raise HTTPException(status_code=404, detail="Region not found")

    settings = get_settings()
    pdf_path = materialize_file(
        settings.storage_dir,
        row[0],
        get_object_storage(settings),
    )
    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail="Lecture PDF file not found")

    match = match_region(
        region_id=region.id,
        query=f"{region.label} {region.transcription}",
        slides=extract_pdf(pdf_path),
    )
    persist_match(connection, session_id, match)
    return match
