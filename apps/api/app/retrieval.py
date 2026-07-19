import re

from app.schemas.deck import ExtractedSlide, TextSpan
from app.schemas.match import MatchResponse


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _similarity(query: str, candidate: str) -> float:
    query_tokens = _tokens(query)
    candidate_tokens = _tokens(candidate)
    if not query_tokens or not candidate_tokens:
        return 0.0
    return len(query_tokens & candidate_tokens) / len(query_tokens | candidate_tokens)


def match_region(
    region_id: str,
    query: str,
    slides: list[ExtractedSlide],
) -> MatchResponse:
    best_slide: ExtractedSlide | None = None
    best_score = 0.0
    best_text = ""
    best_highlights: list[TextSpan] = []

    for slide in slides:
        slide_text = " ".join(span.text for span in slide.spans)
        score = _similarity(query, slide_text)
        if score > best_score:
            best_slide = slide
            best_score = score
            best_text = slide_text
            query_tokens = _tokens(query)
            best_highlights = [
                span for span in slide.spans if _tokens(span.text) & query_tokens
            ]

    if best_slide is None or best_score == 0:
        return MatchResponse(
            region_id=region_id,
            status="no_match",
            slide_number=None,
            passage="",
            highlights=[],
            similarity_score=0.0,
            reason="No shared terms were found in the extracted slide text.",
        )

    status = "matched" if best_score >= 0.2 else "uncertain"
    reason = (
        "The slide shares enough terms with the notebook region."
        if status == "matched"
        else "The slide is the best lexical match, but the score is low."
    )
    return MatchResponse(
        region_id=region_id,
        status=status,
        slide_number=best_slide.slide_number,
        passage=best_text,
        highlights=best_highlights,
        similarity_score=best_score,
        reason=reason,
    )
