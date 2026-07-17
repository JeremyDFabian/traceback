from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from openai import APITimeoutError, OpenAIError
from pydantic import ValidationError

from app.schemas.flashcards import (
    Flashcard,
    FlashcardSourceInput,
    GeneratedFlashcard,
    GeneratedFlashcardBatch,
    GenerateFlashcardsRequest,
    GenerateFlashcardsResponse,
)
from app.services.flashcards import FlashcardGenerationError, OpenAIFlashcardGenerator


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


def generated_batch(*questions: str) -> GeneratedFlashcardBatch:
    return GeneratedFlashcardBatch(
        flashcards=[
            GeneratedFlashcard(question=question, answer="Answer", difficulty="easy")
            for question in questions
        ]
    )


def test_generator_parses_one_flashcard_from_the_source() -> None:
    client = MagicMock()
    client.responses.parse.return_value = SimpleNamespace(output_parsed=generated_batch("Question"))
    source = FlashcardSourceInput(**source_payload())

    cards = OpenAIFlashcardGenerator(client, "test-model").generate(source, 1)

    assert cards == generated_batch("Question").flashcards
    kwargs = client.responses.parse.call_args.kwargs
    assert kwargs["model"] == "test-model"
    assert kwargs["text_format"] is GeneratedFlashcardBatch
    assert "Create exactly 1 flashcard" in kwargs["input"][1]["content"]
    assert source.note_text in kwargs["input"][1]["content"]


def test_generator_rejects_missing_parsed_output() -> None:
    client = MagicMock()
    client.responses.parse.return_value = SimpleNamespace(output_parsed=None)

    with pytest.raises(FlashcardGenerationError, match="no parsed output"):
        OpenAIFlashcardGenerator(client, "test-model").generate(
            FlashcardSourceInput(**source_payload()), 1
        )


def test_generator_rejects_wrong_card_count() -> None:
    client = MagicMock()
    client.responses.parse.return_value = SimpleNamespace(output_parsed=generated_batch("One"))

    with pytest.raises(FlashcardGenerationError, match="expected 2 cards"):
        OpenAIFlashcardGenerator(client, "test-model").generate(
            FlashcardSourceInput(**source_payload()), 2
        )


def test_generator_rejects_normalized_duplicate_questions() -> None:
    client = MagicMock()
    client.responses.parse.return_value = SimpleNamespace(
        output_parsed=generated_batch("What is ATP?", "  what   is   atp?  ")
    )

    with pytest.raises(FlashcardGenerationError, match="duplicate questions"):
        OpenAIFlashcardGenerator(client, "test-model").generate(
            FlashcardSourceInput(**source_payload()), 2
        )


@pytest.mark.parametrize(
    "error",
    [
        OpenAIError("provider failed"),
        APITimeoutError(request=MagicMock()),
        ValidationError.from_exception_data("GeneratedFlashcardBatch", []),
    ],
    ids=["openai", "timeout", "validation"],
)
def test_generator_wraps_provider_and_parser_errors(error: Exception) -> None:
    client = MagicMock()
    client.responses.parse.side_effect = error

    with pytest.raises(FlashcardGenerationError, match="provider request failed"):
        OpenAIFlashcardGenerator(client, "test-model").generate(
            FlashcardSourceInput(**source_payload()), 1
        )


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
