from dataclasses import dataclass
from typing import Any, cast

from pydantic import BaseModel

from app.core.config import Settings
from app.schemas.notebook_analysis import NotebookAnalysisResult

GEMINI_NOTEBOOK_ANALYSIS_PROMPT = """
Analyze this single photographed notebook page for an interactive study surface.
Return only the schema-defined JSON result.

Rules:
- Transcribe only clearly visible handwritten or printed text.
- Return at most 8 non-overlapping regions for the clearest concepts or headings.
- Use stable ids: region_1, region_2, and relationship_1, relationship_2.
- Use only these region types: concept, definition, question, example, or other.
- Bounding boxes are normalized to 0.0 through 1.0 relative to the entire image.
- Add at most 6 relationships, only for unambiguous drawn arrows or connecting lines.
- Detect star and question markers only when clearly visible.
- Use low confidence and an uncertainty note when unsure.
- Include a short page summary.
- Prefer empty regions, relationships, or markers over invented information.
""".strip()


@dataclass(frozen=True)
class GeminiAnalysis:
    result: NotebookAnalysisResult | None
    warnings: list[str]


def gemini_response_schema(
    model: type[BaseModel] = NotebookAnalysisResult,
) -> dict[str, Any]:
    """Return a Gemini-compatible version of the Pydantic response schema."""
    schema = model.model_json_schema()
    remove_unsupported_schema_keywords(schema)
    return schema


def remove_unsupported_schema_keywords(value: Any) -> None:
    if isinstance(value, dict):
        schema_object = cast(dict[str, Any], value)
        schema_object.pop("exclusiveMinimum", None)
        for child in schema_object.values():
            remove_unsupported_schema_keywords(child)
    elif isinstance(value, list):
        schema_list = cast(list[Any], value)
        for child in schema_list:
            remove_unsupported_schema_keywords(child)


def analyze_notebook_with_gemini(
    image_bytes: bytes,
    settings: Settings,
) -> GeminiAnalysis:
    api_key = settings.gemini_api_key
    if api_key is None or not api_key.get_secret_value().strip():
        return GeminiAnalysis(result=None, warnings=["gemini_api_key_missing_using_local_fallback"])

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key.get_secret_value())
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                GEMINI_NOTEBOOK_ANALYSIS_PROMPT,
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=gemini_response_schema(),
                temperature=0,
            ),
        )
        if not response.text:
            return GeminiAnalysis(
                result=None,
                warnings=["gemini_empty_response_using_local_fallback"],
            )

        result = NotebookAnalysisResult.model_validate_json(response.text)
    except Exception:
        return GeminiAnalysis(result=None, warnings=["gemini_analysis_failed_using_local_fallback"])

    if not result.regions:
        return GeminiAnalysis(result=None, warnings=["gemini_no_regions_using_local_fallback"])

    return GeminiAnalysis(result=result, warnings=["gemini_vision_analysis_used"])
