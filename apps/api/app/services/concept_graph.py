import json
from collections.abc import Callable

from openai import OpenAI, OpenAIError
from pydantic import BaseModel, Field, ValidationError

from app.core.config import Settings, get_settings
from app.schemas.learning import (
    ApprovedNotebookPages,
    GraphEdge,
    GraphNode,
    GraphResponse,
    GraphSource,
)
from app.services.notebook_analysis.gemini import gemini_response_schema

GRAPH_RELATIONSHIP_PROMPT = """
Find meaningful relationships between concepts from different approved notebook pages.
Return only relationships supported by the supplied excerpts.

Rules:
- Use only submitted concept IDs as source and target.
- Prefer relationships across different pages.
- Give each relationship a concise verb phrase.
- Do not add concepts, facts, citations, or outside knowledge.
- Confidence must reflect how directly the excerpts support the relationship.
""".strip()


class GraphGenerationError(RuntimeError):
    pass


class GeneratedGraphEdge(BaseModel):
    source: str
    target: str
    label: str
    confidence: float = Field(ge=0, le=1)


class GeneratedGraphRelationships(BaseModel):
    relationships: list[GeneratedGraphEdge] = []


GraphRelationshipGenerator = Callable[[ApprovedNotebookPages], list[GraphEdge]]


def normalize_label(label: str) -> str:
    return " ".join(label.casefold().split())


def build_concept_graph(
    pages: ApprovedNotebookPages,
    generated_edges: list[GraphEdge] | None = None,
) -> GraphResponse:
    nodes: dict[str, GraphNode] = {}
    region_nodes: dict[tuple[str, str], str] = {}

    for page in pages.pages:
        for region in page.regions:
            node_id = normalize_label(region.label)
            region_nodes[(page.page_id, region.id)] = node_id
            source = GraphSource(
                page_id=page.page_id,
                region_id=region.id,
                excerpt=region.transcription,
                bbox=region.bbox,
            )
            if node_id in nodes:
                nodes[node_id].sources.append(source)
                nodes[node_id].confidence = max(nodes[node_id].confidence, region.confidence)
            else:
                nodes[node_id] = GraphNode(
                    id=node_id,
                    label=region.label.strip(),
                    type=region.type,
                    confidence=region.confidence,
                    sources=[source],
                )

    candidate_edges: list[GraphEdge] = []
    for page in pages.pages:
        for relationship in page.relationships:
            source = region_nodes.get((page.page_id, relationship.source_region_id))
            target = region_nodes.get((page.page_id, relationship.target_region_id))
            if source is None or target is None:
                continue
            candidate_edges.append(
                GraphEdge(
                    id=f"{page.page_id}:{relationship.id}",
                    source=source,
                    target=target,
                    label=relationship.label,
                    confidence=relationship.confidence,
                )
            )
    candidate_edges.extend(generated_edges or [])

    valid_ids = set(nodes)
    edges: dict[tuple[str, str, str | None], GraphEdge] = {}
    for edge in candidate_edges:
        source = normalize_label(edge.source)
        target = normalize_label(edge.target)
        if source not in valid_ids or target not in valid_ids or source == target:
            continue
        normalized = edge.model_copy(
            update={
                "source": source,
                "target": target,
                "review_required": edge.confidence < 0.70,
            }
        )
        key = (source, target, edge.label)
        if key not in edges or edges[key].confidence < normalized.confidence:
            edges[key] = normalized

    return GraphResponse(nodes=list(nodes.values()), edges=list(edges.values()))


def generate_cross_page_edges(
    pages: ApprovedNotebookPages,
    settings: Settings | None = None,
    generator: GraphRelationshipGenerator | None = None,
) -> list[GraphEdge]:
    if generator is not None:
        return generator(pages)
    if len(pages.pages) < 2:
        return []

    active_settings = settings or get_settings()
    if active_settings.openai_analysis_enabled:
        result = _generate_with_openai(pages, active_settings)
    elif active_settings.gemini_analysis_enabled:
        result = _generate_with_gemini(pages, active_settings)
    else:
        return []
    return _to_graph_edges(result)


def _approved_payload(pages: ApprovedNotebookPages) -> str:
    concepts = [
        {
            "id": normalize_label(region.label),
            "page_id": page.page_id,
            "region_id": region.id,
            "label": region.label,
            "excerpt": region.transcription,
        }
        for page in pages.pages
        for region in page.regions
    ]
    return json.dumps({"concepts": concepts}, ensure_ascii=False)


def _generate_with_openai(
    pages: ApprovedNotebookPages,
    settings: Settings,
) -> GeneratedGraphRelationships:
    api_key = settings.openai_api_key
    if api_key is None or not api_key.get_secret_value().strip():
        raise GraphGenerationError("OpenAI API key is missing")
    try:
        response = OpenAI(
            api_key=api_key.get_secret_value(), timeout=30.0, max_retries=0
        ).responses.parse(
            model=settings.openai_vision_model,
            instructions=GRAPH_RELATIONSHIP_PROMPT,
            input=_approved_payload(pages),
            text_format=GeneratedGraphRelationships,
        )
        if response.output_parsed is None:
            raise GraphGenerationError("OpenAI returned no graph relationships")
        return response.output_parsed
    except (OpenAIError, ValidationError) as error:
        raise GraphGenerationError("OpenAI graph generation failed") from error


def _generate_with_gemini(
    pages: ApprovedNotebookPages,
    settings: Settings,
) -> GeneratedGraphRelationships:
    api_key = settings.gemini_api_key
    if api_key is None or not api_key.get_secret_value().strip():
        raise GraphGenerationError("Gemini API key is missing")
    try:
        from google import genai
        from google.genai import types

        response = genai.Client(api_key=api_key.get_secret_value()).models.generate_content(
            model=settings.gemini_model,
            contents=f"{GRAPH_RELATIONSHIP_PROMPT}\n\n{_approved_payload(pages)}",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=gemini_response_schema(GeneratedGraphRelationships),
                temperature=0,
            ),
        )
        if not response.text:
            raise GraphGenerationError("Gemini returned no graph relationships")
        return GeneratedGraphRelationships.model_validate_json(response.text)
    except GraphGenerationError:
        raise
    except Exception as error:
        raise GraphGenerationError("Gemini graph generation failed") from error


def _to_graph_edges(result: GeneratedGraphRelationships) -> list[GraphEdge]:
    return [
        GraphEdge(
            id=f"cross-{index}",
            source=edge.source,
            target=edge.target,
            label=edge.label,
            confidence=edge.confidence,
        )
        for index, edge in enumerate(result.relationships, start=1)
    ]
