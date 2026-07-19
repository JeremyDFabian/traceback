from pydantic import SecretStr

from app.core.config import Settings
from app.schemas.notebook_analysis import BoundingBox, NotebookAnalysisResult, NotebookRegion
from app.services.notebook_analysis.openai import (
    analyze_notebook_with_openai,
    replace_generic_region_labels,
)


def test_openai_analysis_uses_local_fallback_without_api_key() -> None:
    analysis = analyze_notebook_with_openai(
        b"not-an-image",
        Settings(
            database_url="postgresql://test:test@localhost:5432/traceback",
            analysis_engine="openai",
            openai_api_key=SecretStr(""),
        ),
    )

    assert analysis.result is None
    assert analysis.warnings == ["openai_api_key_missing_using_local_fallback"]


def test_openai_replaces_generic_label_with_transcription() -> None:
    result = NotebookAnalysisResult(
        regions=[
            NotebookRegion(
                id="region_1",
                label="Heading",
                transcription="Louis Pasteur",
                type="other",
                bbox=BoundingBox(x=0.1, y=0.1, width=0.2, height=0.1),
                confidence=0.9,
            )
        ],
        confidence=0.9,
    )

    normalized = replace_generic_region_labels(result)

    assert normalized.regions[0].label == "Louis Pasteur"