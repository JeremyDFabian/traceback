from dataclasses import dataclass
from typing import Any, cast

from pydantic import BaseModel

from app.core.config import Settings
from app.schemas.notebook_analysis import NotebookAnalysisResult

GEMINI_NOTEBOOK_ANALYSIS_PROMPT = """
Analyze this single photographed notebook page for an interactive study surface.
Return only the schema-defined JSON result.

Rules:
- Treat the photograph as the source of truth. First determine the page's upright
  reading orientation from the image. OCR/layout data is optional, fallible evidence:
  it may be rotated, faint, or garbled. Ignore it whenever it conflicts with the image.
- Never reproduce punctuation-heavy, digit-heavy, or nonsensical OCR fragments in
  typed_text. Omit an unclear line rather than guessing or displaying gibberish.
- Preserve the source order and visible structure. Do not turn notes into a prose
  summary or merge separate facts.
- Format typed_text as a compact Markdown outline using only this contract:
  * Use `# Topic` only when the source visibly contains a real topic heading.
  * Use `- fact` for a top-level bullet and `  - detail` for an indented supporting detail.
  * Use `1. fact` only when the source visibly uses a numbered sequence.
  * Keep a visible name or term and the contribution immediately following it together
    on one bullet: `- Name - contribution`.
- Never promote a person, author, example, or the first list item to a heading. If no
  real topic heading is visible, omit the heading.
- Preserve every visible name, term, and contribution. If a name is on one line and
  its contribution is on the next, combine them into that same bullet. Never drop the
  name, turn it into a heading, or attach it to the wrong contribution.
- When the structure is uncertain, preserve the original lines as separate bullets
  instead of guessing a hierarchy.
- Do not copy a long page summary into typed_text; page_summary is separate metadata.
- Omit unreadable OCR fragments rather than showing OCR gibberish.
-
- Every region needs a concise label and a highlight_text phrase that appears verbatim
  in typed_text. highlight_text must be a key study concept of one to five words.
- Never use a whole sentence, OCR line, heading, or generic placeholder as
  highlight_text. Headings stay plain text in the PDF.
- Use only these region types: concept, definition, question, example, or other.
- Never use generic labels such as Heading, Subheading, Content, Notes, List, or Definition.
- Return three to eight unique, non-overlapping regions only when the concepts are clear.
- Use stable ids: region_1, region_2, and relationship_1, relationship_2.
- Bounding boxes are normalized to 0.0 through 1.0 relative to the entire image.
- Add at most 6 relationships, only for unambiguous drawn arrows or connecting lines.
- Detect star and question markers only when clearly visible.
- Use low confidence and an uncertainty note when unsure.
- Include a short page summary.
- Give every region one student-friendly sentence in explanation.
- Give every region two or three concise trusted_source_queries. They must be plain
  search phrases, never URLs, domains, citations, or source names.
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
