from typing import Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.api.analysis import confirmed_analysis_storage_key
from app.core.config import get_settings
from app.db import get_connection
from app.schemas.analysis import AnalysisResult
from app.schemas.learning import (
    FlashcardSuggestion,
    GraphEdge,
    GraphNode,
    GraphResponse,
)
from app.storage import load_json

router = APIRouter(tags=["learning"])


def _load_confirmed_analysis(
    connection: psycopg.Connection[Any],
    session_id: UUID,
) -> AnalysisResult:
    row = connection.execute(
        "select id from public.sessions where id = %s",
        (session_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        return AnalysisResult.model_validate(
            load_json(
                get_settings().storage_dir,
                confirmed_analysis_storage_key(session_id),
            )
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Confirmed analysis not found") from error


@router.get("/sessions/{session_id}/graph", response_model=GraphResponse)
def get_graph(
    session_id: UUID,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> GraphResponse:
    analysis = _load_confirmed_analysis(connection, session_id)
    nodes = [
        GraphNode(id=region.id, label=region.label, type=region.type)
        for region in analysis.regions
    ]
    edges = [
        GraphEdge(
            id=relationship.id,
            source=relationship.source_region_id,
            target=relationship.target_region_id,
            label=relationship.label,
        )
        for relationship in analysis.relationships
    ]
    return GraphResponse(nodes=nodes, edges=edges)


@router.post(
    "/sessions/{session_id}/flashcards/generate",
    response_model=list[FlashcardSuggestion],
)
def generate_flashcards(
    session_id: UUID,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> list[FlashcardSuggestion]:
    analysis = _load_confirmed_analysis(connection, session_id)
    suggestions: list[FlashcardSuggestion] = []

    for region in analysis.regions:
        if not region.markers:
            continue
        marker = region.markers[0]
        if marker == "question":
            question = f"What should you clarify about {region.label}?"
        else:
            question = f"What is {region.label}, and why is it important?"
        suggestions.append(
            FlashcardSuggestion(
                id=f"card_{region.id}",
                region_id=region.id,
                question=question,
                answer=region.transcription,
                source_slide=None,
                status="suggested",
            )
        )

    return suggestions
