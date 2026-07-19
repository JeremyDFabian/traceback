from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.api import analysis, matches
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
    assert connection.execute.call_count == 2


def test_match_requires_confirmed_analysis(tmp_path, monkeypatch) -> None:
    connection = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.return_value = ("lecture-deck.pdf",)
    connection.execute.return_value = cursor
    monkeypatch.setattr(
        matches,
        "get_settings",
        lambda: SimpleNamespace(storage_dir=tmp_path),
    )
    app.dependency_overrides[get_connection] = lambda: connection

    try:
        response = TestClient(app).post(
            f"/api/sessions/{SESSION_ID}/regions/region_1/match"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Confirmed analysis not found"}
