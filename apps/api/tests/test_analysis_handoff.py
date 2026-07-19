from app.schemas.analysis import AnalysisResult
from app.schemas.notebook_analysis import BoundingBox, NotebookAnalysisResult, NotebookRegion


def test_notebook_analysis_result_matches_member_three_contract() -> None:
    result = NotebookAnalysisResult(
        page_summary="Cellular respiration notes",
        regions=[
            NotebookRegion(
                id="region_1",
                label="ATP",
                transcription="ATP stores energy.",
                type="concept",
                bbox=BoundingBox(x=0.1, y=0.2, width=0.2, height=0.1),
                markers=["star"],
                confidence=0.9,
            )
        ],
        confidence=0.9,
    )

    persisted = AnalysisResult.model_validate(result.model_dump())

    assert persisted.page_summary == "Cellular respiration notes"
    assert persisted.regions[0].type == "concept"