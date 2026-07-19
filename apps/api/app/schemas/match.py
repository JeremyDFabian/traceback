from typing import Literal

from pydantic import BaseModel

from app.schemas.deck import TextSpan

MatchStatus = Literal["matched", "uncertain", "no_match"]


class MatchResponse(BaseModel):
    region_id: str
    status: MatchStatus
    slide_number: int | None
    passage: str
    highlights: list[TextSpan]
    similarity_score: float
    reason: str
