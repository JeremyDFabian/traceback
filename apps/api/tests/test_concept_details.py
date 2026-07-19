from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.main import app
from app.schemas.concept_details import ConceptDetailsRequest
from app.services.concept_details import get_concept_details


def test_concept_details_uses_safe_search_fallback() -> None:
    result = get_concept_details(
        ConceptDetailsRequest(label="Mitochondria"),
        Settings(
            database_url="postgresql://test:test@localhost:5432/traceback",
            analysis_engine="gemini",
            gemini_api_key=SecretStr(""),
        ),
    )

    assert result.label == "Mitochondria"
    assert result.confidence == 0.0
    assert result.warnings == ["gemini_api_key_missing_using_search_links"]
    assert result.sources[0].url.endswith("Mitochondria")


def test_concept_details_endpoint_returns_contract() -> None:
    response = TestClient(app).post(
        "/api/concept-details",
        json={"label": "Mitochondria", "transcription": "Produces ATP."},
    )

    assert response.status_code == 200
    assert response.json()["label"] == "Mitochondria"
    assert len(response.json()["sources"]) == 2

def test_concept_details_uses_openai_search_fallback_without_api_key() -> None:
    result = get_concept_details(
        ConceptDetailsRequest(label="Mitochondria"),
        Settings(
            database_url="postgresql://test:test@localhost:5432/traceback",
            analysis_engine="openai",
            openai_api_key=SecretStr(""),
        ),
    )

    assert result.confidence == 0.0
    assert result.warnings == ["openai_api_key_missing_using_search_links"]