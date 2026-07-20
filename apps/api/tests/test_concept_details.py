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


def test_concept_details_uses_the_selected_note_as_a_fallback_definition() -> None:
    result = get_concept_details(
        ConceptDetailsRequest(
            label="Bounding boxes",
            transcription="Bounding boxes describe the area around a selected item.",
        ),
        Settings(
            database_url="postgresql://test:test@localhost:5432/traceback",
            analysis_engine="local",
        ),
    )

    assert result.definition == (
        "In your notes: Bounding boxes describe the area around a selected item."
    )


def test_concept_details_endpoint_returns_contract() -> None:
    response = TestClient(app).post(
        "/api/concept-details",
        json={"label": "Mitochondria", "transcription": "Produces ATP."},
    )

    assert response.status_code == 200
    assert response.json()["label"] == "Mitochondria"
    assert len(response.json()["sources"]) == 3


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


def test_concept_details_uses_precomputed_terra_explanation_and_approved_sources() -> None:
    result = get_concept_details(
        ConceptDetailsRequest(
            label="Mitochondria",
            explanation="Mitochondria help cells produce usable energy.",
            trusted_source_queries=["mitochondria cellular energy"],
        ),
        Settings(
            database_url="postgresql://test:test@localhost:5432/traceback",
            analysis_engine="local",
        ),
    )

    assert result.definition == "Mitochondria help cells produce usable energy."
    assert result.warnings == ["precomputed_terra_explanation_used"]
    assert [source.title for source in result.sources] == [
        "OpenStax on Mitochondria",
        "Nature Education on Mitochondria",
        "Khan Academy on Mitochondria",
    ]
    assert all("mitochondria+cellular+energy" in source.url for source in result.sources)


def test_concept_details_uses_medical_sources_for_microbiology() -> None:
    result = get_concept_details(
        ConceptDetailsRequest(label="Microbes are ubiquitous"),
        Settings(
            database_url="postgresql://test:test@localhost:5432/traceback",
            analysis_engine="local",
        ),
    )

    assert [source.title for source in result.sources] == [
        "CDC resources on Microbes are ubiquitous",
        "PubMed research on Microbes are ubiquitous",
        "NCBI Bookshelf on Microbes are ubiquitous",
    ]
