from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Difficulty = Literal["easy", "medium", "hard"]


class FlashcardSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class FlashcardSourceInput(FlashcardSchema):
    session_id: UUID
    region_id: str = Field(min_length=1, max_length=200)
    slide_number: int = Field(ge=1)
    note_text: str = Field(min_length=1, max_length=20_000)
    slide_text: str = Field(min_length=1, max_length=50_000)


class GenerateFlashcardsRequest(FlashcardSchema):
    source: FlashcardSourceInput
    count: int = Field(default=5, ge=1, le=10)


class GeneratedFlashcard(FlashcardSchema):
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=2_000)
    difficulty: Difficulty


class GeneratedFlashcardBatch(FlashcardSchema):
    flashcards: list[GeneratedFlashcard] = Field(min_length=1, max_length=10)


class FlashcardSourceReference(FlashcardSchema):
    session_id: UUID
    region_id: str = Field(min_length=1, max_length=200)
    slide_number: int = Field(ge=1)


class Flashcard(FlashcardSchema):
    id: UUID
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=2_000)
    difficulty: Difficulty
    source: FlashcardSourceReference


class GenerateFlashcardsResponse(FlashcardSchema):
    flashcards: list[Flashcard] = Field(min_length=1, max_length=10)
