from typing import Literal

from pydantic import BaseModel

from app.schemas.deck import TextSpan
from app.schemas.flashcards import HighlightBox

MatchStatus = Literal["matched", "uncertain", "no_match"]


class MatchResponse(BaseModel):
    region_id: str
    status: MatchStatus
    slide_number: int | None
    passage: str
    highlights: list[TextSpan]
    highlight_boxes: list[HighlightBox]
    similarity_score: float
    reason: str
