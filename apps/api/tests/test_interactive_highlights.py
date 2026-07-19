from app.schemas.notebook_analysis import BoundingBox, NotebookRegion
from app.services.notebook_analysis.highlights import (
    build_heuristic_highlights,
    filter_interactive_regions,
)


def make_region(
    region_id: str,
    highlight_text: str,
    transcription: str,
    confidence: float = 0.9,
) -> NotebookRegion:
    return NotebookRegion(
        id=region_id,
        label=highlight_text,
        highlight_text=highlight_text,
        transcription=transcription,
        type="concept",
        bbox=BoundingBox(x=0.1, y=0.1, width=0.2, height=0.1),
        confidence=confidence,
    )


def test_filter_interactive_regions_keeps_short_verified_terms() -> None:
    retained = filter_interactive_regions(
        [
            make_region("mitochondria", "Mitochondria", "Mitochondria produce ATP."),
            make_region("atp", "ATP", "Mitochondria produce ATP."),
        ],
        "Mitochondria produce ATP during cellular respiration.",
    )

    assert [region.highlight_text for region in retained] == ["Mitochondria", "ATP"]


def test_filter_interactive_regions_rejects_sentences_duplicates_and_missing_text() -> None:
    retained = filter_interactive_regions(
        [
            make_region(
                "sentence",
                "Mitochondria produce ATP",
                "Mitochondria produce ATP",
            ),
            make_region("first-atp", "ATP", "ATP stores energy."),
            make_region("duplicate-atp", "atp", "ATP stores energy."),
            make_region("missing", "Nucleus", "Nucleus controls cells."),
        ],
        "Mitochondria produce ATP. ATP stores energy.",
    )

    assert [region.id for region in retained] == ["first-atp"]


def test_heuristic_highlights_recover_title_case_topics_from_ocr() -> None:
    retained = build_heuristic_highlights(
        [
            make_region(
                "region_1",
                "",
                "Political Power and the Milgram Experiment",
            ),
            make_region("region_2", "", "Groupthink affects decisions."),
        ],
        "Political Power and the Milgram Experiment. Groupthink affects decisions.",
    )

    assert [region.highlight_text for region in retained] == [
        "Political Power",
        "Milgram Experiment",
        "Groupthink",
    ]
