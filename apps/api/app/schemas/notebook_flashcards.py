from typing import Literal

from pydantic import BaseModel, Field


class NotebookHighlightInput(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    phrase: str = Field(min_length=1, max_length=200)


def _default_highlights() -> list[NotebookHighlightInput]:
    return []


class NotebookFlashcardRequest(BaseModel):
    typed_text: str = Field(min_length=1, max_length=20_000)
    highlights: list[NotebookHighlightInput] = Field(
        default_factory=_default_highlights, max_length=30
    )
    count: int = Field(default=5, ge=3, le=10)


class NotebookFlashcard(BaseModel):
    id: str
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=2_000)
    difficulty: Literal["easy", "medium", "hard"]
    source_phrase: str | None = None


class GeneratedNotebookFlashcard(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=2_000)
    difficulty: Literal["easy", "medium", "hard"]
    source_phrase: str | None = None


class GeneratedNotebookFlashcardBatch(BaseModel):
    flashcards: list[GeneratedNotebookFlashcard] = Field(min_length=1, max_length=10)


class NotebookFlashcardResponse(BaseModel):
    flashcards: list[NotebookFlashcard] = Field(min_length=1, max_length=10)
