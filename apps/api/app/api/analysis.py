from typing import Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.core.config import get_settings
from app.db import get_connection
from app.schemas.analysis import AnalysisResult
from app.storage import load_json, save_json

router = APIRouter(tags=["analysis"])


def _require_session(
    connection: psycopg.Connection[Any],
    session_id: UUID,
) -> None:
    row = connection.execute(
        "select id from public.sessions where id = %s",
        (session_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")


def analysis_storage_key(session_id: UUID) -> str:
    return f"analysis/{session_id}.json"


def confirmed_analysis_storage_key(session_id: UUID) -> str:
    return f"confirmed-analysis/{session_id}.json"


@router.post("/sessions/{session_id}/analysis", response_model=AnalysisResult)
def save_analysis(
    session_id: UUID,
    analysis: AnalysisResult,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> AnalysisResult:
    _require_session(connection, session_id)
    save_json(get_settings().storage_dir, analysis_storage_key(session_id), analysis)
    return analysis


@router.get("/sessions/{session_id}/analysis", response_model=AnalysisResult)
def get_analysis(
    session_id: UUID,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> AnalysisResult:
    _require_session(connection, session_id)
    try:
        return AnalysisResult.model_validate(
            load_json(get_settings().storage_dir, analysis_storage_key(session_id))
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Analysis not found") from error


@router.post("/sessions/{session_id}/confirm", response_model=AnalysisResult)
def confirm_analysis(
    session_id: UUID,
    analysis: AnalysisResult,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> AnalysisResult:
    _require_session(connection, session_id)
    save_json(
        get_settings().storage_dir,
        confirmed_analysis_storage_key(session_id),
        analysis,
    )
    connection.execute(
        "update public.sessions set status = 'ready' where id = %s",
        (session_id,),
    )
    return analysis
