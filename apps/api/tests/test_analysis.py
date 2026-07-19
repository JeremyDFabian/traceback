from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient

from app.api import analysis
from app.db import get_connection
from app.main import app

SESSION_ID = UUID("00000000-0000-4000-8000-000000000001")
ANALYSIS = {
    "page_summary": "Cellular respiration notes",
    "regions": [
        {
            "id": "region_1",
            "label": "ATP",
            "transcription": "ATP",
            "type": "concept",
            "bbox": {"x": 0.1, "y": 0.2, "width": 0.2, "height": 0.1},
            "markers": ["star"],
            "confidence": 0.9,
        }
    ],
    "relationships": [],
}


def test_save_and_get_analysis(tmp_path, monkeypatch) -> None:
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

    try:
        client = TestClient(app)
        save_response = client.post(f"/api/sessions/{SESSION_ID}/analysis", json=ANALYSIS)
        get_response = client.get(f"/api/sessions/{SESSION_ID}/analysis")
    finally:
        app.dependency_overrides.clear()

    assert save_response.status_code == 200
    assert get_response.status_code == 200
    assert get_response.json() == ANALYSIS
