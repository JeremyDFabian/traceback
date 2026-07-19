from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.api import uploads
from app.db import get_connection
from app.main import app


def test_upload_deck_saves_file_and_updates_session(tmp_path, monkeypatch) -> None:
    session_id = UUID("00000000-0000-4000-8000-000000000001")
    connection = MagicMock()
    session_cursor = MagicMock()
    session_cursor.fetchone.return_value = (session_id,)
    connection.execute.side_effect = [session_cursor, MagicMock()]
    monkeypatch.setattr(
        uploads,
        "get_settings",
        lambda: SimpleNamespace(storage_dir=tmp_path),
    )
    app.dependency_overrides[get_connection] = lambda: connection

    try:
        response = TestClient(app).post(
            f"/api/sessions/{session_id}/deck",
            files={"file": ("slides.pdf", b"pdf-content", "application/pdf")},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    body = response.json()
    assert body["session_id"] == str(session_id)
    assert body["kind"] == "deck"
    assert (tmp_path / body["storage_path"]).read_bytes() == b"pdf-content"
    assert connection.execute.call_count == 2
