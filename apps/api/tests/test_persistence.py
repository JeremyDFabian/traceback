from unittest.mock import MagicMock
from uuid import UUID

from app.persistence import (
    persist_analysis,
    persist_flashcard_suggestions,
    persist_match,
    persist_slide_passages,
)
from app.schemas.analysis import AnalysisResult
from app.schemas.deck import ExtractedSlide, TextSpan
from app.schemas.learning import FlashcardSuggestion
from app.schemas.match import MatchResponse

SESSION_ID = UUID("00000000-0000-4000-8000-000000000001")


def test_persist_analysis_writes_regions_markers_and_relationships() -> None:
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = (UUID(int=2),)
    analysis = AnalysisResult.model_validate(
        {
            "page_summary": "Notes",
            "regions": [
                {
                    "id": "region_1",
                    "label": "ATP",
                    "transcription": "ATP",
                    "type": "concept",
                    "bbox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.2},
                    "markers": ["star"],
                    "confidence": 0.9,
                },
                {
                    "id": "region_2",
                    "label": "Mitochondria",
                    "transcription": "Mitochondria",
                    "type": "concept",
                    "bbox": {"x": 0.5, "y": 0.2, "width": 0.3, "height": 0.2},
                    "markers": [],
                    "confidence": 0.8,
                },
            ],
            "relationships": [
                {
                    "id": "relationship_1",
                    "source_region_id": "region_1",
                    "target_region_id": "region_2",
                    "label": "produced by",
                    "confidence": 0.7,
                }
            ],
        }
    )

    persist_analysis(connection, SESSION_ID, analysis)

    statements = [call.args[0] for call in connection.execute.call_args_list]
    assert statements[0].startswith("delete from public.analysis_relationships")
    assert statements[1].startswith("delete from public.analysis_regions")
    assert sum("insert into public.analysis_regions" in statement for statement in statements) == 2
    assert any("insert into public.analysis_markers" in statement for statement in statements)
    assert any("insert into public.analysis_relationships" in statement for statement in statements)


def test_persist_slide_passages_normalizes_coordinates() -> None:
    connection = MagicMock()
    slides = [
        ExtractedSlide(
            slide_number=1,
            width=200,
            height=100,
            spans=[TextSpan(text="ATP", x=20, y=10, width=100, height=20)],
        )
    ]

    persist_slide_passages(connection, SESSION_ID, slides)

    insert_call = connection.execute.call_args_list[1]
    assert insert_call.args[1] == (SESSION_ID, 1, 0, "ATP", 0.1, 0.1, 0.5, 0.2)


def test_persist_match_writes_low_confidence_status() -> None:
    connection = MagicMock()
    match = MatchResponse(
        region_id="region_1",
        status="uncertain",
        slide_number=2,
        passage="ATP",
        highlights=[],
        similarity_score=0.15,
        reason="Low score",
    )

    persist_match(connection, SESSION_ID, match)

    assert connection.execute.call_args.args[1] == (SESSION_ID, "region_1", 0.15, "uncertain")


def test_persist_flashcard_suggestions_replaces_session_projection() -> None:
    connection = MagicMock()
    suggestion = FlashcardSuggestion(
        id="card_region_1",
        region_id="region_1",
        question="What is ATP?",
        answer="Energy carrier",
        source_slide=None,
        status="suggested",
    )

    persist_flashcard_suggestions(connection, SESSION_ID, [suggestion])

    assert connection.execute.call_count == 2
    assert (
        "delete from public.flashcard_suggestions" in connection.execute.call_args_list[0].args[0]
    )
