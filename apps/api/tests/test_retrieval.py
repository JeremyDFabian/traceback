from app.retrieval import match_region
from app.schemas.deck import ExtractedSlide, TextSpan


def test_match_region_returns_slide_and_highlight() -> None:
    slides = [
        ExtractedSlide(
            slide_number=3,
            width=200,
            height=100,
            spans=[
                TextSpan(
                    text="Mitochondria produce ATP",
                    x=20,
                    y=30,
                    width=120,
                    height=12,
                )
            ],
        )
    ]

    result = match_region("region_1", "ATP", slides)

    assert result.status == "matched"
    assert result.slide_number == 3
    assert result.highlights[0].text == "Mitochondria produce ATP"
    assert [box.model_dump() for box in result.highlight_boxes] == [
        {
            "x": 0.1,
            "y": 0.3,
            "width": 0.6,
            "height": 0.12,
        }
    ]


def test_match_region_returns_no_match_without_shared_terms() -> None:
    slides = [
        ExtractedSlide(slide_number=1, width=200, height=100, spans=[]),
    ]

    result = match_region("region_1", "photosynthesis", slides)

    assert result.status == "no_match"
    assert result.slide_number is None
    assert result.highlight_boxes == []
