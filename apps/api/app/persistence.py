from typing import Any
from uuid import UUID

import psycopg

from app.schemas.analysis import AnalysisResult
from app.schemas.deck import ExtractedSlide
from app.schemas.learning import FlashcardSuggestion
from app.schemas.match import MatchResponse


def persist_analysis(
    connection: psycopg.Connection[Any],
    session_id: UUID,
    analysis: AnalysisResult,
) -> None:
    """Replace the database projection of one session's analysis."""
    connection.execute(
        "delete from public.analysis_relationships where session_id = %s",
        (session_id,),
    )
    connection.execute(
        "delete from public.analysis_regions where session_id = %s",
        (session_id,),
    )

    region_ids: dict[str, UUID] = {}
    for region in analysis.regions:
        row = connection.execute(
            """
            insert into public.analysis_regions (
              session_id, external_id, label, transcription, region_type,
              bbox_x, bbox_y, bbox_width, bbox_height, confidence
            ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            returning id
            """,
            (
                session_id,
                region.id,
                region.label,
                region.transcription,
                region.type,
                region.bbox.x,
                region.bbox.y,
                region.bbox.width,
                region.bbox.height,
                region.confidence,
            ),
        ).fetchone()
        if row is None:
            raise RuntimeError(f"Database did not return region ID for {region.id}")
        region_ids[region.id] = row[0]

        for marker in region.markers:
            connection.execute(
                """
                insert into public.analysis_markers (region_id, marker_type, confidence)
                values (%s, %s, %s)
                on conflict (region_id, marker_type) do update
                set confidence = excluded.confidence
                """,
                (row[0], marker, region.confidence),
            )

    for relationship in analysis.relationships:
        if (
            relationship.source_region_id not in region_ids
            or relationship.target_region_id not in region_ids
        ):
            continue
        connection.execute(
            """
            insert into public.analysis_relationships (
              session_id, external_id, source_region_external_id,
              target_region_external_id, label, confidence
            ) values (%s, %s, %s, %s, %s, %s)
            """,
            (
                session_id,
                relationship.id,
                relationship.source_region_id,
                relationship.target_region_id,
                relationship.label,
                relationship.confidence,
            ),
        )


def persist_slide_passages(
    connection: psycopg.Connection[Any],
    session_id: UUID,
    slides: list[ExtractedSlide],
) -> None:
    """Replace the extracted text-span projection for one session."""
    connection.execute(
        "delete from public.slide_passages where session_id = %s",
        (session_id,),
    )
    for slide in slides:
        for passage_index, span in enumerate(slide.spans):
            connection.execute(
                """
                insert into public.slide_passages (
                  session_id, slide_number, passage_index, text,
                  bbox_x, bbox_y, bbox_width, bbox_height
                ) values (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    session_id,
                    slide.slide_number,
                    passage_index,
                    span.text,
                    span.x / slide.width,
                    span.y / slide.height,
                    span.width / slide.width,
                    span.height / slide.height,
                ),
            )


def persist_match(
    connection: psycopg.Connection[Any],
    session_id: UUID,
    match: MatchResponse,
) -> None:
    connection.execute(
        """
        insert into public.region_matches (
          session_id, region_external_id, similarity_score, match_status
        ) values (%s, %s, %s, %s)
        """,
        (
            session_id,
            match.region_id,
            match.similarity_score,
            "uncertain" if match.status == "uncertain" else "candidate",
        ),
    )


def persist_flashcard_suggestions(
    connection: psycopg.Connection[Any],
    session_id: UUID,
    suggestions: list[FlashcardSuggestion],
) -> None:
    connection.execute(
        "delete from public.flashcard_suggestions where session_id = %s",
        (session_id,),
    )
    for suggestion in suggestions:
        connection.execute(
            """
            insert into public.flashcard_suggestions (
              session_id, external_id, region_external_id, question,
              answer, source_slide, suggestion_status
            ) values (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                session_id,
                suggestion.id,
                suggestion.region_id,
                suggestion.question,
                suggestion.answer,
                suggestion.source_slide,
                suggestion.status,
            ),
        )
