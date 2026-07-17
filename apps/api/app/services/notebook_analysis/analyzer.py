from app.schemas.notebook_analysis import (
    BoundingBox,
    NotebookAnalysisRequest,
    NotebookAnalysisResult,
    NotebookMarker,
    NotebookRegion,
    NotebookRelationship,
)


async def analyze_notebook_page(
    request: NotebookAnalysisRequest,
) -> NotebookAnalysisResult:
    """Return a temporary mock analysis result until vision analysis is wired in."""
    return NotebookAnalysisResult(
        page_summary="Mock notebook analysis result",
        regions=[
            NotebookRegion(
                id="region_1",
                label="Mitochondria",
                transcription="Mitochondria",
                type="concept",
                bbox=BoundingBox(x=0.18, y=0.3, width=0.24, height=0.08),
                markers=[],
                confidence=0.94,
            ),
            NotebookRegion(
                id="region_2",
                label="ATP",
                transcription="ATP",
                type="concept",
                bbox=BoundingBox(x=0.62, y=0.31, width=0.12, height=0.07),
                markers=["star"],
                confidence=0.91,
            ),
        ],
        relationships=[
            NotebookRelationship(
                id="edge_1",
                source_region_id="region_1",
                target_region_id="region_2",
                label="produces",
                type="arrow",
                confidence=0.78,
            )
        ],
        markers=[
            NotebookMarker(
                id="marker_1",
                type="star",
                region_id="region_2",
                bbox=BoundingBox(x=0.58, y=0.29, width=0.04, height=0.05),
                confidence=0.88,
            )
        ],
        warnings=[],
        confidence=0.89,
    )
