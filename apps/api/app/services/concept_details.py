from dataclasses import dataclass
from urllib.parse import quote_plus

from openai import OpenAI, OpenAIError
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.schemas.concept_details import (
    ConceptDetailsRequest,
    ConceptDetailsResult,
    ConceptSource,
    GeneratedConceptDetails,
)
from app.services.notebook_analysis.gemini import gemini_response_schema

CONCEPT_DETAILS_PROMPT = """
Explain the study concept below for a student.
Return only the requested structured result.

Rules:
- Give one concise, accurate definition.
- Return two to four short key points.
- Use the optional notebook context only to clarify the concept.
- Do not invent facts, citations, or URLs.
- If the concept is ambiguous, state that in the definition and use lower confidence.
""".strip()


@dataclass(frozen=True)
class ConceptDetailsAnalysis:
    details: GeneratedConceptDetails | None
    warnings: list[str]


def get_concept_details(
    request: ConceptDetailsRequest,
    settings: Settings | None = None,
) -> ConceptDetailsResult:
    active_settings = settings or get_settings()
    sources = build_search_sources(request.label)

    if active_settings.openai_analysis_enabled:
        analysis = analyze_concept_with_openai(request, active_settings)
    elif active_settings.gemini_analysis_enabled:
        analysis = analyze_concept_with_gemini(request, active_settings)
    else:
        return build_fallback_result(
            request.label,
            sources,
            "remote_concept_details_disabled_using_search_links",
        )

    if analysis.details is None:
        return build_fallback_result(request.label, sources, *analysis.warnings)

    return ConceptDetailsResult(
        label=request.label,
        definition=analysis.details.definition,
        key_points=analysis.details.key_points,
        sources=sources,
        confidence=analysis.details.confidence,
        warnings=analysis.warnings,
    )


def analyze_concept_with_openai(
    request: ConceptDetailsRequest,
    settings: Settings,
) -> ConceptDetailsAnalysis:
    api_key = settings.openai_api_key
    if api_key is None or not api_key.get_secret_value().strip():
        return ConceptDetailsAnalysis(
            details=None,
            warnings=["openai_api_key_missing_using_search_links"],
        )

    try:
        context = request.transcription or "No notebook context was provided."
        client = OpenAI(api_key=api_key.get_secret_value(), timeout=30.0, max_retries=0)
        response = client.responses.parse(
            model=settings.openai_vision_model,
            instructions=CONCEPT_DETAILS_PROMPT,
            input=f"Concept: {request.label}\nContext: {context}",
            text_format=GeneratedConceptDetails,
            temperature=0,
        )
        details = response.output_parsed
    except (OpenAIError, ValidationError):
        return ConceptDetailsAnalysis(
            details=None,
            warnings=["openai_concept_details_failed_using_search_links"],
        )

    if details is None:
        return ConceptDetailsAnalysis(
            details=None,
            warnings=["openai_empty_response_using_search_links"],
        )

    return ConceptDetailsAnalysis(details=details, warnings=["openai_concept_details_used"])


def analyze_concept_with_gemini(
    request: ConceptDetailsRequest,
    settings: Settings,
) -> ConceptDetailsAnalysis:
    api_key = settings.gemini_api_key
    if api_key is None or not api_key.get_secret_value().strip():
        return ConceptDetailsAnalysis(
            details=None,
            warnings=["gemini_api_key_missing_using_search_links"],
        )

    try:
        from google import genai
        from google.genai import types

        context = request.transcription or "No notebook context was provided."
        client = genai.Client(api_key=api_key.get_secret_value())
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=f"{CONCEPT_DETAILS_PROMPT}\n\nConcept: {request.label}\nContext: {context}",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=gemini_response_schema(GeneratedConceptDetails),
                temperature=0,
            ),
        )
        if not response.text:
            return ConceptDetailsAnalysis(
                details=None,
                warnings=["gemini_empty_response_using_search_links"],
            )
        details = GeneratedConceptDetails.model_validate_json(response.text)
    except Exception:
        return ConceptDetailsAnalysis(
            details=None,
            warnings=["gemini_concept_details_failed_using_search_links"],
        )

    return ConceptDetailsAnalysis(details=details, warnings=["gemini_concept_details_used"])


def build_search_sources(label: str) -> list[ConceptSource]:
    query = quote_plus(label)
    return [
        ConceptSource(
            title=f"Search Wikipedia for {label}",
            url=f"https://en.wikipedia.org/w/index.php?search={query}",
        ),
        ConceptSource(
            title=f"Search Google for {label}",
            url=f"https://www.google.com/search?q={query}",
        ),
    ]


def build_fallback_result(
    label: str,
    sources: list[ConceptSource],
    *warnings: str,
) -> ConceptDetailsResult:
    return ConceptDetailsResult(
        label=label,
        definition=(
            "An AI explanation is unavailable right now. "
            "Use the reference links to study this concept."
        ),
        key_points=[],
        sources=sources,
        confidence=0.0,
        warnings=list(warnings),
    )
