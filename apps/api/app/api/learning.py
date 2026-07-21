from typing import Any
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.api.analysis import confirmed_analysis_storage_key
from app.core.config import get_settings
from app.db import get_connection
from app.persistence import persist_flashcard_suggestions
from app.schemas.analysis import AnalysisResult
from app.schemas.learning import (
    ApprovedNotebookPage,
    ApprovedNotebookPages,
    ConfirmPageResponse,
    FlashcardSuggestion,
    GraphEdge,
    GraphNode,
    GraphResponse,
)
from app.services.concept_graph import (
    GraphGenerationError,
    build_concept_graph,
    generate_cross_page_edges,
)
from app.storage import get_object_storage, load_json, save_json

router = APIRouter(tags=["learning"])


def approved_pages_storage_key(session_id: UUID) -> str:
    return f"approved-pages/{session_id}.json"


def graph_storage_key(session_id: UUID) -> str:
    return f"concept-graphs/{session_id}.json"


def _require_session(connection: psycopg.Connection[Any], session_id: UUID) -> None:
    row = connection.execute(
        "select id from public.sessions where id = %s",
        (session_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")


def _load_approved_pages(session_id: UUID) -> ApprovedNotebookPages:
    settings = get_settings()
    try:
        return ApprovedNotebookPages.model_validate(
            load_json(
                settings.storage_dir,
                approved_pages_storage_key(session_id),
                get_object_storage(settings),
            )
        )
    except FileNotFoundError:
        return ApprovedNotebookPages()


def _refresh_graph(session_id: UUID, pages: ApprovedNotebookPages) -> GraphResponse:
    settings = get_settings()
    graph = build_concept_graph(
        pages,
        generate_cross_page_edges(pages, settings),
    )
    save_json(
        settings.storage_dir,
        graph_storage_key(session_id),
        graph,
        get_object_storage(settings),
    )
    return graph


def _load_confirmed_analysis(
    connection: psycopg.Connection[Any],
    session_id: UUID,
) -> AnalysisResult:
    _require_session(connection, session_id)

    try:
        return AnalysisResult.model_validate(
            load_json(
                get_settings().storage_dir,
                confirmed_analysis_storage_key(session_id),
                get_object_storage(get_settings()),
            )
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Confirmed analysis not found") from error


@router.get("/sessions/{session_id}/graph", response_model=GraphResponse)
def get_graph(
    session_id: UUID,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> GraphResponse:
    _require_session(connection, session_id)
    settings = get_settings()
    try:
        return GraphResponse.model_validate(
            load_json(
                settings.storage_dir,
                graph_storage_key(session_id),
                get_object_storage(settings),
            )
        )
    except FileNotFoundError:
        pages = _load_approved_pages(session_id)
        if pages.pages:
            return build_concept_graph(pages)

    analysis = _load_confirmed_analysis(connection, session_id)
    nodes = [
        GraphNode(id=region.id, label=region.label, type=region.type) for region in analysis.regions
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
    "/sessions/{session_id}/pages/{page_id}/confirm",
    response_model=ConfirmPageResponse,
)
def confirm_notebook_page(
    session_id: UUID,
    page_id: str,
    page: ApprovedNotebookPage,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> ConfirmPageResponse:
    _require_session(connection, session_id)
    if page.page_id != page_id:
        raise HTTPException(status_code=400, detail="Page ID does not match request path")

    pages = _load_approved_pages(session_id)
    pages.pages = [existing for existing in pages.pages if existing.page_id != page_id]
    pages.pages.append(page)
    settings = get_settings()
    save_json(
        settings.storage_dir,
        approved_pages_storage_key(session_id),
        pages,
        get_object_storage(settings),
    )

    try:
        _refresh_graph(session_id, pages)
    except GraphGenerationError:
        return ConfirmPageResponse(page=page, graph_status="pending")
    return ConfirmPageResponse(page=page, graph_status="ready")


@router.post("/sessions/{session_id}/graph/refresh", response_model=GraphResponse)
def refresh_graph(
    session_id: UUID,
    connection: psycopg.Connection[Any] = Depends(get_connection),
) -> GraphResponse:
    _require_session(connection, session_id)
    pages = _load_approved_pages(session_id)
    try:
        return _refresh_graph(session_id, pages)
    except GraphGenerationError as error:
        raise HTTPException(status_code=503, detail="Graph generation failed") from error


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

    persist_flashcard_suggestions(connection, session_id, suggestions)
    return suggestions
