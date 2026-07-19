from typing import Any, Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.db import get_connection
from app.schemas.upload import UploadResponse
from app.storage import save_upload

router = APIRouter(tags=["uploads"])
UploadKind = Literal["deck", "notebook_page"]
SessionPathColumn = Literal["lecture_pdf_path", "notebook_image_path"]


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


def _upload_file(
    connection: psycopg.Connection[Any],
    session_id: UUID,
    upload: UploadFile,
    kind: UploadKind,
    expected_content_prefix: str,
    column_name: SessionPathColumn,
) -> UploadResponse:
    if not upload.content_type or not upload.content_type.startswith(expected_content_prefix):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    _require_session(connection, session_id)
    storage_path = save_upload(
        get_settings().storage_dir,
        session_id,
        kind,
        upload,
    )
    if column_name == "lecture_pdf_path":
        connection.execute(
            "update public.sessions set lecture_pdf_path = %s where id = %s",
            (storage_path, session_id),
        )
    else:
        connection.execute(
            "update public.sessions set notebook_image_path = %s where id = %s",
            (storage_path, session_id),
        )
    return UploadResponse(
        session_id=session_id,
        kind=kind,
        storage_path=storage_path,
    )


@router.post(
    "/sessions/{session_id}/deck",
    response_model=UploadResponse,
    status_code=201,
)
def upload_deck(
    session_id: UUID,
    file: UploadFile = File(...),
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> UploadResponse:
    return _upload_file(
        connection,
        session_id,
        file,
        "deck",
        "application/pdf",
        "lecture_pdf_path",
    )


@router.post(
    "/sessions/{session_id}/notebook-page",
    response_model=UploadResponse,
    status_code=201,
)
def upload_notebook_page(
    session_id: UUID,
    file: UploadFile = File(...),
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> UploadResponse:
    return _upload_file(
        connection,
        session_id,
        file,
        "notebook_page",
        "image/",
        "notebook_image_path",
    )
