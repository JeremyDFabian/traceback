from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.api import analysis
from app.db import get_connection
from app.main import app

SESSION_ID = UUID("00000000-0000-4000-8000-000000000001")


def test_confirm_analysis_saves_reviewed_result(tmp_path, monkeypatch) -> None:
    connection = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.return_value = (SESSION_ID,)
    connection.execute.return_value = cursor
    monkeypatch.setattr(
        analysis,
        "get_settings",
        lambda: SimpleNamespace(storage_dir=tmp_path),
    )
    app.dependency_overrides[get_connection] = lambda: connection

    payload = {
        "page_summary": "Confirmed notes",
        "regions": [],
        "relationships": [],
    }
    try:
        response = TestClient(app).post(
            f"/api/sessions/{SESSION_ID}/confirm",
            json=payload,
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == payload
    statements = [call.args[0] for call in connection.execute.call_args_list]
    assert any("select id from public.sessions" in statement for statement in statements)
    assert any(
        "update public.sessions set status = 'ready'" in statement for statement in statements
    )
