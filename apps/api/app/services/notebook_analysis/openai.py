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
- Use supplied OCR/layout regions as primary evidence for bounding boxes.
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
                                "Analyze the notebook photograph as primary evidence. OCR/layout "
                                "regions are optional hints and may be wrong for rotated or faint handwriting. Return the requested structured result.\n\n"
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
