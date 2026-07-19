import base64
import json
from dataclasses import dataclass

from openai import OpenAI, OpenAIError
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.notebook_analysis import NotebookAnalysisResult, NotebookRegion

OPENAI_NOTEBOOK_ANALYSIS_PROMPT = """
Analyze this single photographed notebook page for an interactive study surface.
Return only the requested structured result.

Rules:
- Produce clean typed_text from only clearly visible handwritten or printed text.
- Use the supplied OCR/layout regions as the primary evidence for transcription and
  bounding boxes. Correct them only when the image makes the correction unambiguous.
- Every region label must be the actual short concept from the note transcription.
- Use only these region types: concept, definition, question, example, or other.
- Never use generic labels such as Heading, Subheading, Content, Notes, List, or Definition.
- Return at most 8 non-overlapping regions for the clearest concepts or headings.
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
class OpenAIAnalysis:
    result: NotebookAnalysisResult | None
    warnings: list[str]


def analyze_notebook_with_openai(
    image_bytes: bytes,
    settings: Settings,
    ocr_regions: list[NotebookRegion] | None = None,
) -> OpenAIAnalysis:
    api_key = settings.openai_api_key
    if api_key is None or not api_key.get_secret_value().strip():
        return OpenAIAnalysis(result=None, warnings=["openai_api_key_missing_using_local_fallback"])

    image_data_url = "data:image/jpeg;base64," + base64.b64encode(image_bytes).decode("ascii")
    try:
        client = OpenAI(api_key=api_key.get_secret_value(), timeout=45.0, max_retries=0)
        response = client.responses.parse(
            model=settings.openai_vision_model,
            instructions=OPENAI_NOTEBOOK_ANALYSIS_PROMPT,
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Analyze this notebook image using these OCR/layout regions as "
                                "grounding data. Return the requested structured result.\n\n"
                                f"OCR/layout regions:\n{serialize_ocr_regions(ocr_regions or [])}"
                            ),
                        },
                        {
                            "type": "input_image",
                            "image_url": image_data_url,
                            "detail": "high",
                        },
                    ],
                }
            ],
            text_format=NotebookAnalysisResult,
        )
        result = response.output_parsed
    except (OpenAIError, ValidationError):
        return OpenAIAnalysis(result=None, warnings=["openai_analysis_failed_using_local_fallback"])

    if result is None:
        return OpenAIAnalysis(result=None, warnings=["openai_empty_response_using_local_fallback"])
    if not result.regions:
        return OpenAIAnalysis(result=None, warnings=["openai_no_regions_using_local_fallback"])

    return OpenAIAnalysis(
        result=replace_generic_region_labels(result),
        warnings=["openai_vision_analysis_used"],
    )


def serialize_ocr_regions(regions: list[NotebookRegion]) -> str:
    """Give the model bounded OCR/layout evidence without any user-supplied URLs."""
    return json.dumps(
        [
            {
                "text": region.transcription,
                "bbox": region.bbox.model_dump(),
                "confidence": region.confidence,
            }
            for region in regions
        ],
        ensure_ascii=False,
    )


GENERIC_REGION_LABELS = {
    "content",
    "definition",
    "heading",
    "list",
    "notes",
    "subheading",
}


def replace_generic_region_labels(
    result: NotebookAnalysisResult,
) -> NotebookAnalysisResult:
    regions: list[NotebookRegion] = []
    for region in result.regions:
        if region.label.strip().casefold() in GENERIC_REGION_LABELS and region.transcription:
            label = " ".join(region.transcription.split())[:80]
            regions.append(region.model_copy(update={"label": label}))
        else:
            regions.append(region)
    return result.model_copy(update={"regions": regions})
