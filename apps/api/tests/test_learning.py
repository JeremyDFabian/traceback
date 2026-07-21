from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api import analysis, learning
from app.db import get_connection
from app.main import app
from app.schemas.learning import ApprovedNotebookPages, GraphEdge, GraphResponse
from app.services.concept_graph import GraphGenerationError

SESSION_ID = UUID("00000000-0000-4000-8000-000000000001")


def test_graph_contract_keeps_sources_and_marks_low_confidence_edges() -> None:
    graph = GraphResponse.model_validate(
        {
            "nodes": [
                {
                    "id": "cellular respiration",
                    "label": "Cellular respiration",
                    "type": "concept",
                    "confidence": 0.92,
                    "sources": [
                        {
                            "page_id": "page-1",
                            "region_id": "region-1",
                            "excerpt": "Cells release energy from glucose.",
                            "bbox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.1},
                        }
                    ],
                }
            ],
            "edges": [
                {
                    "id": "edge-1",
                    "source": "cellular respiration",
                    "target": "atp",
                    "label": "produces",
                    "confidence": 0.69,
                    "review_required": True,
                }
            ],
        }
    )

    assert graph.nodes[0].sources[0].page_id == "page-1"
    assert graph.edges[0].review_required is True


def test_approved_pages_reject_duplicate_page_ids() -> None:
    page = {
        "page_id": "page-1",
        "page_summary": "Energy notes",
        "typed_text": "ATP stores energy.",
        "regions": [],
        "relationships": [],
    }

    try:
        ApprovedNotebookPages(pages=[page, page])
    except ValidationError:
        return

    raise AssertionError("duplicate page IDs must be rejected")


def approved_page_payload(page_id: str, label: str) -> dict[str, object]:
    return {
        "page_id": page_id,
        "page_summary": f"Notes about {label}",
        "typed_text": f"{label} appears in these notes.",
        "regions": [
            {
                "id": f"region-{page_id}",
                "label": label,
                "transcription": f"{label} appears in these notes.",
                "type": "concept",
                "bbox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.1},
                "markers": [],
                "confidence": 0.9,
            }
        ],
        "relationships": [],
    }


def configured_client(tmp_path, monkeypatch) -> TestClient:
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = (SESSION_ID,)
    settings = SimpleNamespace(storage_dir=tmp_path)
    monkeypatch.setattr(learning, "get_settings", lambda: settings)
    app.dependency_overrides[get_connection] = lambda: connection
    return TestClient(app)


def test_confirm_page_saves_approved_pages_and_refreshes_graph(tmp_path, monkeypatch) -> None:
    client = configured_client(tmp_path, monkeypatch)
    monkeypatch.setattr(learning, "generate_cross_page_edges", lambda pages, settings: [])

    try:
        response = client.post(
            f"/api/sessions/{SESSION_ID}/pages/page-1/confirm",
            json=approved_page_payload("page-1", "ATP"),
        )
        graph_response = client.get(f"/api/sessions/{SESSION_ID}/graph")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["graph_status"] == "ready"
    assert graph_response.status_code == 200
    assert graph_response.json()["nodes"][0]["sources"][0]["page_id"] == "page-1"


def test_graph_failure_keeps_page_and_previous_cache(tmp_path, monkeypatch) -> None:
    client = configured_client(tmp_path, monkeypatch)
    monkeypatch.setattr(learning, "generate_cross_page_edges", lambda pages, settings: [])

    try:
        client.post(
            f"/api/sessions/{SESSION_ID}/pages/page-1/confirm",
            json=approved_page_payload("page-1", "ATP"),
        )
        previous_graph = client.get(f"/api/sessions/{SESSION_ID}/graph").json()

        def fail_graph(*_args) -> list[GraphEdge]:
            raise GraphGenerationError("provider failed")

        monkeypatch.setattr(learning, "generate_cross_page_edges", fail_graph)
        response = client.post(
            f"/api/sessions/{SESSION_ID}/pages/page-2/confirm",
            json=approved_page_payload("page-2", "Mitochondria"),
        )
        current_graph = client.get(f"/api/sessions/{SESSION_ID}/graph").json()
        saved_pages = ApprovedNotebookPages.model_validate_json(
            (tmp_path / "approved-pages" / f"{SESSION_ID}.json").read_text()
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["graph_status"] == "pending"
    assert saved_pages.pages[-1].page_id == "page-2"
    assert current_graph == previous_graph


def test_refresh_retries_pending_graph_without_resaving_pages(tmp_path, monkeypatch) -> None:
    client = configured_client(tmp_path, monkeypatch)
    monkeypatch.setattr(learning, "generate_cross_page_edges", lambda pages, settings: [])

    try:
        for page_id, label in (("page-1", "ATP"), ("page-2", "Mitochondria")):
            client.post(
                f"/api/sessions/{SESSION_ID}/pages/{page_id}/confirm",
                json=approved_page_payload(page_id, label),
            )
        monkeypatch.setattr(
            learning,
            "generate_cross_page_edges",
            lambda pages, settings: [
                GraphEdge(
                    id="cross-1",
                    source="mitochondria",
                    target="atp",
                    label="produces",
                    confidence=0.91,
                )
            ],
        )
        response = client.post(f"/api/sessions/{SESSION_ID}/graph/refresh")
        saved_pages = ApprovedNotebookPages.model_validate_json(
            (tmp_path / "approved-pages" / f"{SESSION_ID}.json").read_text()
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["edges"][0]["label"] == "produces"
    assert len(saved_pages.pages) == 2


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
        cards_response = client.post(f"/api/sessions/{SESSION_ID}/flashcards/generate")
    finally:
        app.dependency_overrides.clear()

    assert graph_response.status_code == 200
    assert graph_response.json()["nodes"][0]["label"] == "ATP"
    assert cards_response.status_code == 200
    assert cards_response.json()[0]["status"] == "suggested"
