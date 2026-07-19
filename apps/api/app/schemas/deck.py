from pydantic import BaseModel, Field


class TextSpan(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float


class ExtractedSlide(BaseModel):
    slide_number: int
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    spans: list[TextSpan]


class DeckExtractionResponse(BaseModel):
    session_id: str
    slides: list[ExtractedSlide]
