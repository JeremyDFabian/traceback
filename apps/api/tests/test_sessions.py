from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.db import get_connection
from app.main import app


def test_create_session_returns_created_session() -> None:
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = (
        UUID("00000000-0000-4000-8000-000000000001"),
        "created",
        datetime(2026, 7, 19, 12, 0, tzinfo=UTC),
        datetime(2026, 7, 19, 12, 0, tzinfo=UTC),
    )
    app.dependency_overrides[get_connection] = lambda: connection

    try:
        response = TestClient(app).post("/api/sessions")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "created"
    assert body["id"]
    assert body["created_at"]
    assert body["updated_at"]
    connection.execute.assert_called_once()


def test_get_session_returns_existing_session() -> None:
    session_id = UUID("00000000-0000-4000-8000-000000000001")
    created_at = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = (
        session_id,
        "created",
        created_at,
        created_at,
    )
    app.dependency_overrides[get_connection] = lambda: connection

    try:
        response = TestClient(app).get(f"/api/sessions/{session_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "id": str(session_id),
        "status": "created",
        "created_at": "2026-07-19T12:00:00Z",
        "updated_at": "2026-07-19T12:00:00Z",
    }


def test_get_session_returns_not_found_for_unknown_session() -> None:
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = None
    app.dependency_overrides[get_connection] = lambda: connection

    try:
        response = TestClient(app).get(
            "/api/sessions/00000000-0000-4000-8000-000000000002"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Session not found"}
