from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.flashcards import (
    FlashcardSourceInput,
    GeneratedFlashcard,
    GenerateFlashcardsRequest,
)


def source_payload() -> dict[str, object]:
    return {
        "session_id": "123e4567-e89b-12d3-a456-426614174000",
        "region_id": "region-1",
        "slide_number": 1,
        "note_text": "Key point",
        "slide_text": "Slide text",
    }


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
