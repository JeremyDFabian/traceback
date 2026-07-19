from pydantic import BaseModel


class TextSpan(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float


class ExtractedSlide(BaseModel):
    slide_number: int
    width: float
    height: float
    spans: list[TextSpan]


class DeckExtractionResponse(BaseModel):
    session_id: str
    slides: list[ExtractedSlide]
