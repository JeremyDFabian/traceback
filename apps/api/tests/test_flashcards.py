from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.flashcards import (
    Flashcard,
    FlashcardSourceInput,
    GeneratedFlashcard,
    GeneratedFlashcardBatch,
    GenerateFlashcardsRequest,
    GenerateFlashcardsResponse,
)


def source_payload() -> dict[str, object]:
    return {
        "session_id": "123e4567-e89b-12d3-a456-426614174000",
        "region_id": "region-1",
        "slide_number": 1,
        "note_text": "Key point",
        "slide_text": "Slide text",
    }


def generated_flashcard_payload(difficulty: str = "easy") -> dict[str, str]:
    return {"question": "Question", "answer": "Answer", "difficulty": difficulty}


def test_generate_request_defaults_count_to_five() -> None:
    request = GenerateFlashcardsRequest(source=source_payload())

    assert request.count == 5


@pytest.mark.parametrize("count", [0, 11])
def test_generate_request_rejects_count_outside_allowed_range(count: int) -> None:
    with pytest.raises(ValidationError):
        GenerateFlashcardsRequest(source=source_payload(), count=count)


def test_source_rejects_invalid_session_id() -> None:
    payload = source_payload()
    payload["session_id"] = "not-a-uuid"

    with pytest.raises(ValidationError):
        FlashcardSourceInput(**payload)


@pytest.mark.parametrize("region_id", ["", "a" * 201], ids=["empty", "too_long"])
def test_source_rejects_invalid_region_id(region_id: str) -> None:
    payload = source_payload()
    payload["region_id"] = region_id

    with pytest.raises(ValidationError):
        FlashcardSourceInput(**payload)


def test_source_rejects_slide_number_zero() -> None:
    payload = source_payload()
    payload["slide_number"] = 0

    with pytest.raises(ValidationError):
        FlashcardSourceInput(**payload)


@pytest.mark.parametrize("note_text", ["", "a" * 20_001], ids=["empty", "too_long"])
def test_source_rejects_invalid_note_text(note_text: str) -> None:
    payload = source_payload()
    payload["note_text"] = note_text

    with pytest.raises(ValidationError):
        FlashcardSourceInput(**payload)


@pytest.mark.parametrize("slide_text", ["", "a" * 50_001], ids=["empty", "too_long"])
def test_source_rejects_invalid_slide_text(slide_text: str) -> None:
    payload = source_payload()
    payload["slide_text"] = slide_text

    with pytest.raises(ValidationError):
        FlashcardSourceInput(**payload)


def test_generated_flashcard_rejects_invalid_difficulty() -> None:
    with pytest.raises(ValidationError):
        GeneratedFlashcard(question="Question", answer="Answer", difficulty="expert")


@pytest.mark.parametrize("question", ["", "q" * 501], ids=["empty", "too_long"])
def test_generated_flashcard_rejects_invalid_question(question: str) -> None:
    with pytest.raises(ValidationError):
        GeneratedFlashcard(question=question, answer="Answer", difficulty="easy")


@pytest.mark.parametrize("answer", ["", "a" * 2_001], ids=["empty", "too_long"])
def test_generated_flashcard_rejects_invalid_answer(answer: str) -> None:
    with pytest.raises(ValidationError):
        GeneratedFlashcard(question="Question", answer=answer, difficulty="easy")


def test_source_parses_session_id_as_uuid() -> None:
    source = FlashcardSourceInput(**source_payload())

    assert isinstance(source.session_id, UUID)


@pytest.mark.parametrize("difficulty", ["easy", "medium", "hard"])
def test_generated_flashcard_accepts_required_difficulty(difficulty: str) -> None:
    flashcard = GeneratedFlashcard(**generated_flashcard_payload(difficulty))

    assert flashcard.difficulty == difficulty


@pytest.mark.parametrize(
    ("model", "payload"),
    [
        (GenerateFlashcardsRequest, {"source": source_payload(), "unexpected": True}),
        (GeneratedFlashcard, {**generated_flashcard_payload(), "unexpected": True}),
    ],
)
def test_contracts_forbid_unexpected_fields(
    model: type[GenerateFlashcardsRequest] | type[GeneratedFlashcard], payload: dict[str, object]
) -> None:
    with pytest.raises(ValidationError):
        model(**payload)


@pytest.mark.parametrize("flashcards", [[], [generated_flashcard_payload()] * 11])
def test_generated_flashcard_batch_rejects_invalid_list_size(
    flashcards: list[dict[str, str]],
) -> None:
    with pytest.raises(ValidationError):
        GeneratedFlashcardBatch(flashcards=flashcards)


def test_generate_response_parses_flashcard_source_reference() -> None:
    response = GenerateFlashcardsResponse(
        flashcards=[
            {
                "id": "123e4567-e89b-12d3-a456-426614174001",
                **generated_flashcard_payload("medium"),
                "source": {
                    "session_id": "123e4567-e89b-12d3-a456-426614174000",
                    "region_id": "region-1",
                    "slide_number": 1,
                },
            }
        ]
    )

    assert response.flashcards[0].source.session_id == UUID("123e4567-e89b-12d3-a456-426614174000")


def test_flashcard_rejects_invalid_id() -> None:
    with pytest.raises(ValidationError):
        Flashcard(
            id="not-a-uuid",
            **generated_flashcard_payload(),
            source={
                "session_id": "123e4567-e89b-12d3-a456-426614174000",
                "region_id": "region-1",
                "slide_number": 1,
            },
        )
