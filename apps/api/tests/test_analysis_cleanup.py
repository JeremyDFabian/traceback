from app.schemas.notebook_analysis import (
    BoundingBox,
    NotebookAnalysisResult,
    NotebookRegion,
    NotebookRelationship,
)
from app.services.notebook_analysis.cleanup import clean_analysis_result


def region(region_id: str, label: str, x: float, y: float) -> NotebookRegion:
    return NotebookRegion(
        id=region_id,
        label=label,
        transcription=label,
        type="concept",
        bbox=BoundingBox(x=x, y=y, width=0.2, height=0.1),
        confidence=0.9,
    )


def test_cleanup_sorts_regions_and_removes_duplicate_relationships() -> None:
    result = NotebookAnalysisResult(
        regions=[
            region("region_2", "ATP", 0.1, 0.4),
            region("region_1", "Mitochondria", 0.1, 0.1),
            region("region_3", "ATP", 0.11, 0.41),
        ],
        relationships=[
            NotebookRelationship(
                id="relationship_1",
                source_region_id="region_1",
                target_region_id="region_2",
                label="produces",
                confidence=0.9,
            ),
            NotebookRelationship(
                id="relationship_2",
                source_region_id="region_1",
                target_region_id="region_3",
                label="produces",
                confidence=0.9,
            ),
        ],
        confidence=0.9,
    )

    cleaned = clean_analysis_result(result)

    assert [item.id for item in cleaned.regions] == ["region_1", "region_2"]
    assert [item.id for item in cleaned.relationships] == ["relationship_1"]
