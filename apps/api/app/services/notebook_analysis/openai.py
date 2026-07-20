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
- First read the supplied OCR/layout JSON as the transcription draft. Use the image to
  correct obvious OCR character and spelling mistakes only when the handwriting makes
  the correction unambiguous. Do not invent missing content.
- Produce typed_text as clean, spaced study notes: preserve headings, use blank lines
  between sections, and put each detected numbered item on its own line as `1. text`.
- Use a compact digital-notebook outline for typed_text: write a short heading on
  its own line, then one `- ` bullet per distinct fact. Keep a person or concept
  and its contribution on the same bullet using `Name ? contribution` when that
  structure is visible in the notes. Put supporting detail on the next indented line.
- Do not copy a long page summary into typed_text. page_summary is separate metadata.
- Correct merged words and obvious OCR noise only when the image makes the intended
  wording clear. If a fragment remains unreadable or is only OCR gibberish, omit it
  rather than displaying it as a broken sentence.
- Use the supplied OCR/layout regions as the primary evidence for bounding boxes.
- Every region needs a concise label and a highlight_text phrase that appears verbatim
  in typed_text. highlight_text must be a key study concept of one to five words.
- Never use a whole sentence, OCR line, heading, or a generic placeholder as
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
    except (OpenAIError, ValidationError) as exc:
        error_kind = type(exc).__name__.lower()
        return OpenAIAnalysis(
            result=None,
            warnings=[f"openai_analysis_failed_{error_kind}_using_local_fallback"],
        )

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
        if region.label.strip().casefold() in GENERIC_REGION_LABELS and region.highlight_text:
            label = " ".join(region.highlight_text.split())
            regions.append(region.model_copy(update={"label": label}))
        else:
            regions.append(region)
    return result.model_copy(update={"regions": regions})
