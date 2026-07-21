import json
import re
from collections.abc import Callable
from typing import Literal

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
Create a compact, useful concept graph from one or more approved notebook pages.
The graph must teach relationships, not duplicate a bullet list.

Return two layers:
1. Source-grounded concepts: use the supplied concept IDs and direct relationships
   stated in the notes.
2. Learning structure: optionally add a few theme, category, or outcome nodes when
   they make the map easier to study.

Rules:
- A generated node must be type theme, category, or outcome and include the
  submitted concept IDs that support it.
- Do not create a node for every line. Prefer one central theme and a few
  meaningful branches over a crowded map.
- A relationship between two submitted concepts is allowed only when the notes
  explicitly support it. Its label must be concise and grounded in the notes.
- A relationship involving a generated learning-structure node must explain a
  specific learning effect. Use only: "supports", "contributes to",
  "helps prevent", "helps diagnose", "helps treat", "leads to",
  "is an example of", or "is a type of". Never use generic labels such as
  "belongs to" or "related".
- Do not invent people, procedures, diseases, outcomes, or historical claims.
  If a useful category or outcome cannot be inferred reliably, omit it.
- Every generated node and relationship needs confidence >= 0.70. Return an
  empty list when the notes do not support a useful connection.
- Use only submitted concept IDs plus the IDs of generated nodes in relationships.
""".strip()


class GraphGenerationError(RuntimeError):
    pass


class GeneratedGraphNode(BaseModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    type: Literal["theme", "category", "outcome"]
    source_concept_ids: list[str] = Field(min_length=1, max_length=6)
    confidence: float = Field(ge=0, le=1)


class GeneratedGraphEdge(BaseModel):
    source: str
    target: str
    label: str
    confidence: float = Field(ge=0, le=1)


class GeneratedGraphRelationships(BaseModel):
    nodes: list[GeneratedGraphNode] = []
    relationships: list[GeneratedGraphEdge] = []


class GeneratedStudyEdges(list[GraphEdge]):
    """Graph edges plus optional semantic nodes, while remaining list-compatible."""

    def __init__(self, edges: list[GraphEdge], nodes: list[GeneratedGraphNode]):
        super().__init__(edges)
        self.nodes = nodes


GraphRelationshipGenerator = Callable[
    [ApprovedNotebookPages], list[GraphEdge] | GeneratedStudyEdges
]

MIN_GRAPH_EDGE_CONFIDENCE = 0.70
GENERIC_RELATION_WORDS = {"related", "relates", "relationship", "connection", "connects"}
RELATION_STOP_WORDS = {
    "a",
    "an",
    "and",
    "at",
    "by",
    "for",
    "from",
    "in",
    "of",
    "on",
    "the",
    "to",
    "with",
}
LEARNING_RELATION_LABELS = {
    "belongs to",
    "supports",
    "contributes to",
    "helps prevent",
    "helps diagnose",
    "helps treat",
    "leads to",
    "is an example of",
    "is a type of",
}


def normalize_label(label: str) -> str:
    return " ".join(label.casefold().split())


def build_concept_graph(
    pages: ApprovedNotebookPages,
    generated_edges: list[GraphEdge] | GeneratedStudyEdges | None = None,
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

    semantic_nodes = getattr(generated_edges, "nodes", [])
    generated_node_ids = add_semantic_nodes(nodes, semantic_nodes)

    candidate_edges: list[tuple[GraphEdge, bool]] = []
    for page in pages.pages:
        for relationship in page.relationships:
            source = region_nodes.get((page.page_id, relationship.source_region_id))
            target = region_nodes.get((page.page_id, relationship.target_region_id))
            if source is None or target is None:
                continue
            candidate_edges.append(
                (
                    GraphEdge(
                        id=f"{page.page_id}:{relationship.id}",
                        source=source,
                        target=target,
                        label=relationship.label,
                        confidence=relationship.confidence,
                    ),
                    False,
                )
            )
    candidate_edges.extend((edge, True) for edge in generated_edges or [])

    valid_ids = set(nodes)
    edges: dict[tuple[str, str, str | None], GraphEdge] = {}
    for edge, is_generated in candidate_edges:
        source = normalize_label(edge.source)
        target = normalize_label(edge.target)
        if (
            source not in valid_ids
            or target not in valid_ids
            or source == target
            or edge.confidence < MIN_GRAPH_EDGE_CONFIDENCE
            or (is_generated and not has_supported_generated_edge(edge, pages, generated_node_ids))
        ):
            continue
        normalized = edge.model_copy(
            update={
                "source": source,
                "target": target,
                "review_required": False,
            }
        )
        key = (source, target, edge.label)
        if key not in edges or edges[key].confidence < normalized.confidence:
            edges[key] = normalized

    return GraphResponse(nodes=list(nodes.values()), edges=list(edges.values()))


def add_semantic_nodes(
    nodes: dict[str, GraphNode],
    semantic_nodes: list[GeneratedGraphNode],
) -> set[str]:
    """Add small, source-anchored teaching nodes without replacing note concepts."""
    added_ids: set[str] = set()
    for semantic_node in semantic_nodes:
        node_id = normalize_label(semantic_node.id)
        source_ids = [normalize_label(value) for value in semantic_node.source_concept_ids]
        supporting_nodes = [nodes[source_id] for source_id in source_ids if source_id in nodes]
        if (
            node_id in nodes
            or not supporting_nodes
            or semantic_node.confidence < MIN_GRAPH_EDGE_CONFIDENCE
        ):
            continue
        sources = [
            source.model_copy()
            for supporting_node in supporting_nodes
            for source in supporting_node.sources
        ]
        nodes[node_id] = GraphNode(
            id=node_id,
            label=semantic_node.label.strip(),
            type=semantic_node.type,
            confidence=semantic_node.confidence,
            sources=sources,
        )
        added_ids.add(node_id)
    return added_ids


def has_supported_generated_edge(
    edge: GraphEdge,
    pages: ApprovedNotebookPages,
    generated_node_ids: set[str],
) -> bool:
    """Require direct note wording or a constrained semantic learning relation."""
    source = normalize_label(edge.source)
    target = normalize_label(edge.target)
    if source in generated_node_ids or target in generated_node_ids:
        return normalize_label(edge.label or "") in LEARNING_RELATION_LABELS
    return has_verbatim_relationship_evidence(edge, pages)


def has_verbatim_relationship_evidence(
    edge: GraphEdge,
    pages: ApprovedNotebookPages,
) -> bool:
    if not edge.label:
        return False
    label_words = [
        stem_relationship_word(word)
        for word in re.findall(r"[a-z0-9]+", edge.label.casefold())
        if word not in RELATION_STOP_WORDS
    ]
    if not label_words or any(word in GENERIC_RELATION_WORDS for word in label_words):
        return False
    note_words = {
        stem_relationship_word(word)
        for page in pages.pages
        for word in re.findall(r"[a-z0-9]+", page.typed_text.casefold())
    }
    return all(word in note_words for word in label_words)


def stem_relationship_word(word: str) -> str:
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith("s") and len(word) > 3:
        return word[:-1]
    return word


def generate_cross_page_edges(
    pages: ApprovedNotebookPages,
    settings: Settings | None = None,
    generator: GraphRelationshipGenerator | None = None,
) -> list[GraphEdge] | GeneratedStudyEdges:
    if generator is not None:
        return generator(pages)
    active_settings = settings or get_settings()
    if active_settings.openai_analysis_enabled:
        result = _generate_with_openai(pages, active_settings)
    elif active_settings.gemini_analysis_enabled:
        result = _generate_with_gemini(pages, active_settings)
    else:
        return []
    return _to_graph_edges(result)


def _approved_payload(pages: ApprovedNotebookPages) -> str:
    page_payloads: list[dict[str, object]] = []
    for page in pages.pages:
        page_payloads.append(
            {
                "page_id": page.page_id,
                "page_summary": page.page_summary,
                "typed_text": page.typed_text,
                "concepts": [
                    {
                        "id": normalize_label(region.label),
                        "region_id": region.id,
                        "label": region.label,
                        "excerpt": region.transcription,
                    }
                    for region in page.regions
                ],
            }
        )
    return json.dumps({"pages": page_payloads}, ensure_ascii=False)


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


def _to_graph_edges(result: GeneratedGraphRelationships) -> GeneratedStudyEdges:
    return GeneratedStudyEdges(
        [
            GraphEdge(
                id=f"cross-{index}",
                source=edge.source,
                target=edge.target,
                label=edge.label,
                confidence=edge.confidence,
            )
            for index, edge in enumerate(result.relationships, start=1)
        ],
        result.nodes,
    )
