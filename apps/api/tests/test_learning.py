from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.api import analysis, learning
from app.db import get_connection
from app.main import app

SESSION_ID = UUID("00000000-0000-4000-8000-000000000001")


def test_graph_and_flashcard_contracts_use_confirmed_analysis(tmp_path, monkeypatch) -> None:
    connection = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.return_value = (SESSION_ID,)
    connection.execute.return_value = cursor
    monkeypatch.setattr(
        analysis,
        "get_settings",
        lambda: SimpleNamespace(storage_dir=tmp_path),
    )
    monkeypatch.setattr(
        learning,
        "get_settings",
        lambda: SimpleNamespace(storage_dir=tmp_path),
    )
    analysis_payload = {
        "page_summary": "Notes",
        "regions": [
            {
                "id": "region_1",
                "label": "ATP",
                "transcription": "ATP stores energy",
                "type": "concept",
                "bbox": {"x": 0.1, "y": 0.2, "width": 0.2, "height": 0.1},
                "markers": ["star"],
                "confidence": 0.9,
            }
        ],
        "relationships": [],
    }
    analysis_path = tmp_path / "confirmed-analysis" / f"{SESSION_ID}.json"
    analysis_path.parent.mkdir()
    analysis_path.write_text(
        __import__("json").dumps(analysis_payload),
        encoding="utf-8",
    )
    app.dependency_overrides[get_connection] = lambda: connection

    try:
        client = TestClient(app)
        graph_response = client.get(f"/api/sessions/{SESSION_ID}/graph")
        cards_response = client.post(
            f"/api/sessions/{SESSION_ID}/flashcards/generate"
        )
    finally:
        app.dependency_overrides.clear()

    assert graph_response.status_code == 200
    assert graph_response.json()["nodes"][0]["label"] == "ATP"
    assert cards_response.status_code == 200
    assert cards_response.json()[0]["status"] == "suggested"
