from fastapi.testclient import TestClient

from app.main import app


def test_notebook_analysis_returns_overlay_contract() -> None:
    response = TestClient(app).post(
        "/api/notebook-analysis",
        json={
            "image_url": "mock://sample-notebook-page",
            "image_base64": None,
            "manual_crop_bbox": None,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {
        "page_summary",
        "regions",
        "relationships",
        "markers",
        "warnings",
        "confidence",
    }
    assert payload["regions"][0]["bbox"] == {
        "x": 0.18,
        "y": 0.3,
        "width": 0.24,
        "height": 0.08,
    }
    assert payload["regions"][1]["markers"] == ["star"]
    assert payload["relationships"][0]["source_region_id"] == "region_1"
    assert payload["relationships"][0]["target_region_id"] == "region_2"
    assert payload["markers"][0]["region_id"] == "region_2"
