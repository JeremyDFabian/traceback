from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.schemas.notebook_flashcards import (
    NotebookFlashcardRequest,
    NotebookFlashcardResponse,
)
from app.services.notebook_flashcards import (
    NotebookFlashcardGenerationError,
    generate_notebook_flashcards,
)

router = APIRouter(prefix="/notebook-flashcards", tags=["notebook-flashcards"])


@router.post("/generate", response_model=NotebookFlashcardResponse)
def generate_cards(
    request: NotebookFlashcardRequest,
    settings: Settings = Depends(get_settings),
) -> NotebookFlashcardResponse:
    try:
        return generate_notebook_flashcards(request, settings)
    except NotebookFlashcardGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Flashcard generation failed. Please try again.",
        ) from exc
