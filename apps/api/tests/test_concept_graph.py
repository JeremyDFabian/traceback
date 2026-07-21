from app.schemas.analysis import Relationship
from app.schemas.learning import ApprovedNotebookPage, ApprovedNotebookPages, GraphEdge
from app.services.concept_graph import (
    GeneratedGraphNode,
    GeneratedStudyEdges,
    build_concept_graph,
    generate_cross_page_edges,
)


def page(
    page_id: str,
    label: str,
    transcription: str,
    *,
    region_id: str = "region-1",
) -> ApprovedNotebookPage:
    return ApprovedNotebookPage.model_validate(
        {
            "page_id": page_id,
            "page_summary": f"Notes about {label}",
            "typed_text": transcription,
            "regions": [
                {
                    "id": region_id,
                    "label": label,
                    "transcription": transcription,
                    "type": "concept",
                    "bbox": {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.1},
                    "markers": [],
                    "confidence": 0.9,
                }
            ],
            "relationships": [],
        }
    )


def test_build_graph_merges_labels_and_keeps_every_source() -> None:
    pages = ApprovedNotebookPages(
        pages=[
            page("page-1", "ATP", "ATP stores energy."),
            page("page-2", " atp ", "ATP powers cells."),
        ]
    )

    graph = build_concept_graph(pages)

    assert [node.id for node in graph.nodes] == ["atp"]
    assert [source.page_id for source in graph.nodes[0].sources] == ["page-1", "page-2"]


def test_build_graph_discards_unknown_or_low_confidence_edges() -> None:
    pages = ApprovedNotebookPages(
        pages=[
            page("page-1", "ATP", "ATP stores energy."),
            page("page-2", "Mitochondria", "Mitochondria produce ATP."),
        ]
    )

    graph = build_concept_graph(
        pages,
        generated_edges=[
            GraphEdge(
                id="valid",
                source="mitochondria",
                target="atp",
                label="produces",
                confidence=0.69,
            ),
            GraphEdge(
                id="invalid",
                source="missing",
                target="atp",
                label="relates",
                confidence=0.9,
            ),
        ],
    )

    assert graph.edges == []


def test_build_graph_rejects_generated_edges_with_invented_relationship_words() -> None:
    approved_page = page("page-1", "Mitochondria", "Mitochondria produce ATP.")
    approved_page.regions.append(
        approved_page.regions[0].model_copy(
            update={"id": "region-2", "label": "ATP", "transcription": "ATP"}
        )
    )

    graph = build_concept_graph(
        ApprovedNotebookPages(pages=[approved_page]),
        generated_edges=[
            GraphEdge(
                id="invented",
                source="mitochondria",
                target="atp",
                label="relates process to food chain",
                confidence=0.91,
            )
        ],
    )

    assert graph.edges == []


def test_build_graph_preserves_valid_within_page_relationships() -> None:
    approved_page = page("page-1", "Mitochondria", "Mitochondria produce ATP.")
    approved_page.regions.append(
        approved_page.regions[0].model_copy(
            update={"id": "region-2", "label": "ATP", "transcription": "ATP"}
        )
    )
    approved_page.relationships.append(
        Relationship(
            id="within-1",
            source_region_id="region-1",
            target_region_id="region-2",
            label="produces",
            confidence=0.88,
        )
    )

    graph = build_concept_graph(ApprovedNotebookPages(pages=[approved_page]))

    assert graph.edges[0].source == "mitochondria"
    assert graph.edges[0].target == "atp"
    assert graph.edges[0].review_required is False


def test_generate_cross_page_edges_supports_a_single_page_study_map() -> None:
    approved_page = page("page-1", "Mitochondria", "Mitochondria produce ATP.")
    approved_page.regions.append(
        approved_page.regions[0].model_copy(
            update={"id": "region-2", "label": "ATP", "transcription": "ATP"}
        )
    )

    edges = generate_cross_page_edges(
        ApprovedNotebookPages(pages=[approved_page]),
        generator=lambda _: [
            GraphEdge(
                id="within-page-1",
                source="mitochondria",
                target="atp",
                label="produces",
                confidence=0.91,
            )
        ],
    )

    assert edges[0].label == "produces"


def test_build_graph_adds_general_source_anchored_learning_structure() -> None:
    pages = ApprovedNotebookPages(
        pages=[
            page("page-1", "Handwashing", "Semmelweis promoted handwashing."),
            page("page-2", "Smallpox vaccination", "Jenner developed smallpox vaccination."),
        ]
    )
    generated = GeneratedStudyEdges(
        [
            GraphEdge(
                id="prevention-1",
                source="handwashing",
                target="prevention",
                label="helps prevent",
                confidence=0.91,
            ),
            GraphEdge(
                id="prevention-2",
                source="smallpox vaccination",
                target="prevention",
                label="helps prevent",
                confidence=0.91,
            ),
            GraphEdge(
                id="theme-1",
                source="prevention",
                target="medical advances",
                label="belongs to",
                confidence=0.9,
            ),
        ],
        [
            GeneratedGraphNode(
                id="prevention",
                label="Prevention",
                type="category",
                source_concept_ids=["handwashing", "smallpox vaccination"],
                confidence=0.91,
            ),
            GeneratedGraphNode(
                id="medical advances",
                label="Medical advances",
                type="theme",
                source_concept_ids=["handwashing", "smallpox vaccination"],
                confidence=0.9,
            ),
        ],
    )

    graph = build_concept_graph(pages, generated)

    assert {node.id for node in graph.nodes} == {
        "handwashing",
        "smallpox vaccination",
        "prevention",
        "medical advances",
    }
    assert {edge.label for edge in graph.edges} == {"helps prevent", "belongs to"}
    assert next(node for node in graph.nodes if node.id == "prevention").type == "category"
