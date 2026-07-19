import base64
from io import BytesIO

import anyio
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.core.config import Settings
from app.main import app
from app.schemas.notebook_analysis import (
    BoundingBox,
    NotebookAnalysisRequest,
    NotebookRegion,
)
from app.services.notebook_analysis import analyzer
from app.services.notebook_analysis.ocr import (
    OCRAnalysis,
    OCRTextBlock,
    text_blocks_to_regions,
)


def make_base64_test_image() -> str:
    image = Image.new("RGB", (400, 200), "white")
    output = BytesIO()
    image.save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("ascii")


def encode_image(image: Image.Image) -> str:
    output = BytesIO()
    image.save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("ascii")


def make_question_marker_image() -> str:
    image = Image.new("RGB", (200, 200), "white")
    draw = ImageDraw.Draw(image)
    draw.text((78, 42), "?", fill="black", font_size=120)
    return encode_image(image)


def make_star_marker_image() -> str:
    image = Image.new("RGB", (200, 200), "white")
    draw = ImageDraw.Draw(image)
    points = [
        (100, 60),
        (108, 86),
        (136, 86),
        (114, 102),
        (123, 130),
        (100, 112),
        (77, 130),
        (86, 102),
        (64, 86),
        (92, 86),
        (100, 60),
    ]
    draw.line(points, fill="black", width=5)
    return encode_image(image)


def make_arrow_relationship_image() -> str:
    image = Image.new("RGB", (200, 200), "white")
    draw = ImageDraw.Draw(image)
    draw.line([(62, 68), (132, 68)], fill="black", width=4)
    draw.polygon([(132, 68), (118, 59), (118, 77)], fill="black")
    return encode_image(image)


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
        "typed_text",
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
    assert payload["markers"] == []
    assert payload["typed_text"] == "Mitochondria produce ATP during cellular respiration."


def test_notebook_analysis_returns_no_markers_for_blank_base64_image() -> None:
    response = TestClient(app).post(
        "/api/notebook-analysis",
        json={
            "image_url": None,
            "image_base64": make_base64_test_image(),
            "manual_crop_bbox": None,
        },
    )

    assert response.status_code == 200
    assert response.json()["markers"] == []


def test_notebook_analysis_returns_question_marker_candidate() -> None:
    response = TestClient(app).post(
        "/api/notebook-analysis",
        json={
            "image_url": None,
            "image_base64": make_question_marker_image(),
            "manual_crop_bbox": None,
        },
    )

    assert response.status_code == 200
    markers = response.json()["markers"]
    assert any(marker["type"] == "question" for marker in markers)
    assert all(marker["confidence"] <= 0.65 for marker in markers)


def test_notebook_analysis_returns_star_marker_candidate() -> None:
    response = TestClient(app).post(
        "/api/notebook-analysis",
        json={
            "image_url": None,
            "image_base64": make_star_marker_image(),
            "manual_crop_bbox": None,
        },
    )

    assert response.status_code == 200
    markers = response.json()["markers"]
    assert any(marker["type"] == "star" for marker in markers)
    assert all(marker["confidence"] <= 0.65 for marker in markers)


def test_notebook_analysis_returns_arrow_relationship_candidate() -> None:
    response = TestClient(app).post(
        "/api/notebook-analysis",
        json={
            "image_url": None,
            "image_base64": make_arrow_relationship_image(),
            "manual_crop_bbox": None,
        },
    )

    assert response.status_code == 200
    relationships = response.json()["relationships"]
    assert relationships == [
        {
            "id": "edge_1",
            "source_region_id": "region_1",
            "target_region_id": "region_2",
            "label": None,
            "type": "arrow",
            "confidence": 0.45,
            "uncertainty_note": "Heuristic OpenCV arrow detection; user confirmation required.",
        }
    ]


def test_notebook_analysis_preprocesses_base64_image_in_mock_mode() -> None:
    response = TestClient(app).post(
        "/api/notebook-analysis",
        json={
            "image_url": None,
            "image_base64": make_base64_test_image(),
            "manual_crop_bbox": {"x": 0.25, "y": 0.0, "width": 0.5, "height": 1.0},
        },
    )

    assert response.status_code == 200
    assert response.json()["warnings"] == ["manual_crop_applied"]


def fake_analyze_regions_with_ocr(image_array, settings: Settings) -> OCRAnalysis:
    assert image_array.shape[0] == 200
    assert image_array.shape[1] == 400
    assert settings.ocr_engine == "easyocr"
    return OCRAnalysis(
        regions=[
            NotebookRegion(
                id="region_1",
                label="OCR Text",
                transcription="OCR Text",
                type="concept",
                bbox=BoundingBox(x=0.1, y=0.2, width=0.3, height=0.1),
                confidence=0.8,
            )
        ],
        warnings=["easyocr_analysis_used"],
    )


def test_notebook_analysis_uses_ocr_when_enabled(monkeypatch) -> None:
    monkeypatch.setattr(analyzer, "analyze_regions_with_ocr", fake_analyze_regions_with_ocr)

    result = anyio.run(
        analyzer.analyze_notebook_page,
        NotebookAnalysisRequest(image_base64=make_base64_test_image()),
        Settings(
            database_url="postgresql://test:test@localhost:5432/traceback",
            ocr_engine="easyocr",
        ),
    )

    assert result.page_summary == "OCR notebook analysis result"
    assert result.regions[0].label == "OCR Text"
    assert result.warnings == ["easyocr_analysis_used"]
    assert result.confidence == 0.8


def test_notebook_analysis_falls_back_when_ocr_has_no_regions(monkeypatch) -> None:
    def fake_empty_ocr(image_array, settings: Settings) -> OCRAnalysis:
        return OCRAnalysis(regions=[], warnings=["easyocr_not_installed_using_fallback_json"])

    monkeypatch.setattr(analyzer, "analyze_regions_with_ocr", fake_empty_ocr)

    result = anyio.run(
        analyzer.analyze_notebook_page,
        NotebookAnalysisRequest(image_base64=make_base64_test_image()),
        Settings(
            database_url="postgresql://test:test@localhost:5432/traceback",
            ocr_engine="easyocr",
        ),
    )

    assert result.page_summary == "Mock notebook analysis result"
    assert result.warnings == [
        "easyocr_not_installed_using_fallback_json",
        "ocr_returned_no_regions_using_fallback_json",
    ]


def test_text_blocks_to_regions_maps_ocr_text_to_regions() -> None:
    regions = text_blocks_to_regions(
        [
            OCRTextBlock(
                text="ATP",
                bbox=BoundingBox(x=0.1, y=0.2, width=0.3, height=0.1),
                confidence=0.92,
            )
        ]
    )

    assert regions[0].id == "region_1"
    assert regions[0].label == "ATP"
    assert regions[0].transcription == "ATP"
    assert regions[0].confidence == 0.92


def test_notebook_analysis_rejects_invalid_base64_image() -> None:
    response = TestClient(app).post(
        "/api/notebook-analysis",
        json={
            "image_url": None,
            "image_base64": "not valid",
            "manual_crop_bbox": None,
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid base64 notebook image."}


def test_notebook_analysis_requires_image_input() -> None:
    response = TestClient(app).post(
        "/api/notebook-analysis",
        json={
            "image_url": None,
            "image_base64": None,
            "manual_crop_bbox": None,
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Provide either image_base64 or image_url."}
