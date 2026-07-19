from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.api import notebook_flashcards
from app.main import app
from app.schemas.notebook_flashcards import NotebookFlashcardResponse
from app.services.notebook_flashcards import NotebookFlashcardGenerationError


@pytest.fixture
def api_client() -> Iterator[TestClient]:
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def request_payload() -> dict[str, object]:
    return {
        "typed_text": "Mitochondria help cells make ATP through cellular respiration.",
        "highlights": [
            {"id": "mitochondria", "phrase": "Mitochondria"},
            {"id": "atp", "phrase": "ATP"},
        ],
        "count": 3,
    }


def generated_response() -> NotebookFlashcardResponse:
    return NotebookFlashcardResponse(
        flashcards=[
            {
                "id": "card-1",
                "question": "What do mitochondria help cells make?",
                "answer": "They help cells make ATP.",
                "difficulty": "easy",
                "source_phrase": "Mitochondria",
            },
            {
                "id": "card-2",
                "question": "What does ATP provide to cells?",
                "answer": "Usable energy for cellular work.",
                "difficulty": "easy",
                "source_phrase": "ATP",
            },
            {
                "id": "card-3",
                "question": "What process is named in the notes?",
                "answer": "Cellular respiration.",
                "difficulty": "medium",
            },
        ]
    )


def test_notebook_flashcards_returns_cards_from_typed_notes(
    monkeypatch, api_client: TestClient
) -> None:
    received: dict[str, object] = {}

    def fake_generate(request, settings):
        received["request"] = request
        received["settings"] = settings
        return generated_response()

    monkeypatch.setattr(notebook_flashcards, "generate_notebook_flashcards", fake_generate)

    response = api_client.post("/api/notebook-flashcards/generate", json=request_payload())

    assert response.status_code == 200
    assert response.json() == generated_response().model_dump()
    assert received["request"].typed_text == request_payload()["typed_text"]


def test_notebook_flashcards_rejects_invalid_request(api_client: TestClient) -> None:
    payload = request_payload()
    payload["count"] = 2

    response = api_client.post("/api/notebook-flashcards/generate", json=payload)

    assert response.status_code == 422


def test_notebook_flashcards_hides_provider_errors(monkeypatch, api_client: TestClient) -> None:
    def fail_generate(request, settings):
        raise NotebookFlashcardGenerationError("private provider failure")

    monkeypatch.setattr(notebook_flashcards, "generate_notebook_flashcards", fail_generate)

    response = api_client.post("/api/notebook-flashcards/generate", json=request_payload())

    assert response.status_code == 502
    assert response.json() == {"detail": "Flashcard generation failed. Please try again."}
    assert "private provider failure" not in response.text
