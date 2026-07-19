from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.db import get_connection
from app.main import app

SESSION_ID = UUID("00000000-0000-4000-8000-000000000001")
JOB_ID = UUID("00000000-0000-4000-8000-000000000010")
NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)


def job_row() -> tuple[object, ...]:
    return (
        JOB_ID,
        SESSION_ID,
        "queued",
        "indexing_pdf",
        0,
        None,
        None,
        None,
        False,
        NOW,
        NOW,
        None,
    )


def test_create_processing_job_returns_queued_job() -> None:
    connection = MagicMock()
    session_cursor = MagicMock()
    session_cursor.fetchone.return_value = (SESSION_ID,)
    job_cursor = MagicMock()
    job_cursor.fetchone.return_value = job_row()
    connection.execute.side_effect = [session_cursor, job_cursor]
    app.dependency_overrides[get_connection] = lambda: connection

    try:
        response = TestClient(app).post(
            f"/api/sessions/{SESSION_ID}/processing-jobs",
            json={"stage": "indexing_pdf"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["status"] == "queued"
    assert response.json()["stage"] == "indexing_pdf"


def test_get_processing_job_returns_not_found() -> None:
    connection = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.return_value = None
    connection.execute.return_value = cursor
    app.dependency_overrides[get_connection] = lambda: connection

    try:
        response = TestClient(app).get(
            f"/api/sessions/{SESSION_ID}/processing-jobs/{JOB_ID}"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Processing job not found"}
