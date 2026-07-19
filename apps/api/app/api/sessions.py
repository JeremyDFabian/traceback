from typing import Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_connection
from app.schemas.session import SessionResponse

router = APIRouter(tags=["sessions"])


def _session_response_from_row(row: tuple[Any, ...]) -> SessionResponse:
    session_id, status, created_at, updated_at = row
    return SessionResponse(
        id=UUID(str(session_id)),
        status=status,
        created_at=created_at,
        updated_at=updated_at,
    )


@router.post("/sessions", response_model=SessionResponse, status_code=201)
def create_session(
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> SessionResponse:
    row = connection.execute(
        """
        insert into public.sessions default values
        returning id, status, created_at, updated_at
        """
    ).fetchone()

    if row is None:
        raise RuntimeError("Creating a session did not return a database row")

    return _session_response_from_row(row)


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: UUID,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> SessionResponse:
    row = connection.execute(
        """
        select id, status, created_at, updated_at
        from public.sessions
        where id = %s
        """,
        (session_id,),
    ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return _session_response_from_row(row)
