from typing import Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_connection
from app.schemas.job import JobCreateRequest, JobResponse

router = APIRouter(tags=["processing jobs"])


def _job_response_from_row(row: tuple[Any, ...]) -> JobResponse:
    (
        job_id,
        session_id,
        status,
        stage,
        progress,
        result_reference,
        error_code,
        error_message,
        retryable,
        created_at,
        updated_at,
        completed_at,
    ) = row
    return JobResponse(
        id=UUID(str(job_id)),
        session_id=UUID(str(session_id)),
        status=status,
        stage=stage,
        progress=progress,
        result_reference=result_reference,
        error_code=error_code,
        error_message=error_message,
        retryable=retryable,
        created_at=created_at,
        updated_at=updated_at,
        completed_at=completed_at,
    )


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


@router.post(
    "/sessions/{session_id}/processing-jobs",
    response_model=JobResponse,
    status_code=201,
)
def create_processing_job(
    session_id: UUID,
    request: JobCreateRequest,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> JobResponse:
    _require_session(connection, session_id)
    row = connection.execute(
        """
        insert into public.processing_jobs (session_id, stage)
        values (%s, %s)
        returning id, session_id, status, stage, progress,
                  result_reference, error_code, error_message, retryable,
                  created_at, updated_at, completed_at
        """,
        (session_id, request.stage),
    ).fetchone()

    if row is None:
        raise RuntimeError("Creating a processing job did not return a database row")

    return _job_response_from_row(row)


@router.get(
    "/sessions/{session_id}/processing-jobs/{job_id}",
    response_model=JobResponse,
)
def get_processing_job(
    session_id: UUID,
    job_id: UUID,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> JobResponse:
    row = connection.execute(
        """
        select id, session_id, status, stage, progress,
               result_reference, error_code, error_message, retryable,
               created_at, updated_at, completed_at
        from public.processing_jobs
        where id = %s and session_id = %s
        """,
        (job_id, session_id),
    ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Processing job not found")

    return _job_response_from_row(row)
