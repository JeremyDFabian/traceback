from app.schemas.analysis import Relationship
from app.schemas.learning import ApprovedNotebookPage, ApprovedNotebookPages, GraphEdge
from app.services.concept_graph import build_concept_graph, generate_cross_page_edges


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


def test_build_graph_discards_unknown_endpoints_and_marks_review() -> None:
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

    assert [edge.id for edge in graph.edges] == ["valid"]
    assert graph.edges[0].review_required is True


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


def test_generate_cross_page_edges_uses_injected_generator() -> None:
    pages = ApprovedNotebookPages(
        pages=[
            page("page-1", "Mitochondria", "Mitochondria produce ATP."),
            page("page-2", "ATP", "ATP stores usable chemical energy."),
        ]
    )

    edges = generate_cross_page_edges(
        pages,
        generator=lambda _: [
            GraphEdge(
                id="cross-1",
                source="mitochondria",
                target="atp",
                label="produces",
                confidence=0.91,
            )
        ],
    )

    assert edges[0].label == "produces"
