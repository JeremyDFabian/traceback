from functools import lru_cache
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from openai import OpenAI

from app.config import Settings, get_settings
from app.schemas.flashcards import (
    Flashcard,
    FlashcardSourceReference,
    GenerateFlashcardsRequest,
    GenerateFlashcardsResponse,
)
from app.services.flashcards import (
    FlashcardGenerationError,
    FlashcardGenerator,
    OpenAIFlashcardGenerator,
)

router = APIRouter(tags=["flashcards"])


@lru_cache
def _build_openai_generator(api_key: str, model: str) -> OpenAIFlashcardGenerator:
    client = OpenAI(api_key=api_key, timeout=30.0, max_retries=0)
    return OpenAIFlashcardGenerator(client=client, model=model)


def get_flashcard_generator(
    request: GenerateFlashcardsRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> FlashcardGenerator:
    api_key = (
        settings.openai_api_key.get_secret_value() if settings.openai_api_key is not None else ""
    )
    model = (settings.openai_text_model or "").strip()
    if not api_key.strip() or not model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Flashcard generation is not configured",
        )
    return _build_openai_generator(api_key=api_key, model=model)


@router.post("/flashcards/generate", response_model=GenerateFlashcardsResponse)
def generate_flashcards(
    request: GenerateFlashcardsRequest,
    generator: Annotated[FlashcardGenerator, Depends(get_flashcard_generator)],
) -> GenerateFlashcardsResponse:
    try:
        generated = generator.generate(source=request.source, count=request.count)
    except FlashcardGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Flashcard generation failed",
        ) from exc

    source = FlashcardSourceReference(
        session_id=request.source.session_id,
        region_id=request.source.region_id,
        slide_number=request.source.slide_number,
        slide_text=request.source.slide_text,
        highlight_boxes=request.source.highlight_boxes,
    )
    return GenerateFlashcardsResponse(
        flashcards=[
            Flashcard(
                id=uuid4(),
                question=card.question,
                answer=card.answer,
                difficulty=card.difficulty,
                source=source,
            )
            for card in generated
        ]
    )
