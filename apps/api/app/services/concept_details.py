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
    sources = build_search_sources(request.label, request.trusted_source_queries)

    if request.explanation:
        return ConceptDetailsResult(
            label=request.label,
            definition=request.explanation,
            key_points=[],
            sources=sources,
            confidence=1.0,
            warnings=["precomputed_terra_explanation_used"],
        )

    if active_settings.openai_analysis_enabled:
        analysis = analyze_concept_with_openai(request, active_settings)
    elif active_settings.gemini_analysis_enabled:
        analysis = analyze_concept_with_gemini(request, active_settings)
    else:
        return build_fallback_result(
            request,
            request.label,
            sources,
            "remote_concept_details_disabled_using_search_links",
        )

    if analysis.details is None:
        return build_fallback_result(request, request.label, sources, *analysis.warnings)

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


def build_search_sources(label: str, queries: list[str] | None = None) -> list[ConceptSource]:
    query_text = next((query.strip() for query in queries or [] if query.strip()), label)
    query = quote_plus(query_text)
    topic = f"{label} {query_text}".casefold()

    if any(
        term in topic
        for term in (
            "bacteria",
            "virus",
            "microbe",
            "infection",
            "disease",
            "medical",
            "health",
            "syphilis",
        )
    ):
        return [
            ConceptSource(
                title=f"CDC resources on {label}",
                url=f"https://search.cdc.gov/search/?query={query}",
            ),
            ConceptSource(
                title=f"PubMed research on {label}",
                url=f"https://pubmed.ncbi.nlm.nih.gov/?term={query}",
            ),
            ConceptSource(
                title=f"NCBI Bookshelf on {label}",
                url=f"https://www.ncbi.nlm.nih.gov/books/?term={query}",
            ),
        ]

    if any(
        term in topic for term in ("history", "historical", "jenner", "semme", "holmes", "ehrlich")
    ):
        return [
            ConceptSource(
                title=f"Britannica on {label}",
                url=f"https://www.britannica.com/search?query={query}",
            ),
            ConceptSource(
                title=f"NIH history resources on {label}",
                url=f"https://www.nih.gov/search?query={query}",
            ),
            ConceptSource(
                title=f"National Library of Medicine on {label}",
                url=f"https://www.nlm.nih.gov/search/?query={query}",
            ),
        ]

    if any(
        term in topic
        for term in ("cell", "atp", "mitochond", "biology", "genetic", "pcr", "dna", "rna")
    ):
        return [
            ConceptSource(
                title=f"OpenStax on {label}", url=f"https://openstax.org/search?query={query}"
            ),
            ConceptSource(
                title=f"Nature Education on {label}", url=f"https://www.nature.com/search?q={query}"
            ),
            ConceptSource(
                title=f"Khan Academy on {label}",
                url=f"https://www.khanacademy.org/search?page_search_query={query}",
            ),
        ]

    return [
        ConceptSource(
            title=f"Google Scholar research on {label}",
            url=f"https://scholar.google.com/scholar?q={query}",
        ),
        ConceptSource(
            title=f"Britannica on {label}", url=f"https://www.britannica.com/search?query={query}"
        ),
        ConceptSource(
            title=f"Wikipedia on {label}",
            url=f"https://en.wikipedia.org/w/index.php?search={query}",
        ),
    ]


def build_fallback_result(
    request: ConceptDetailsRequest,
    label: str,
    sources: list[ConceptSource],
    *warnings: str,
) -> ConceptDetailsResult:
    context_sentence = next(
        (
            sentence.strip()
            for sentence in (request.transcription or "").replace("\n", " ").split(".")
            if label.casefold() in sentence.casefold()
        ),
        "",
    )
    definition = (
        f"In your notes: {context_sentence}."
        if context_sentence
        else (
            f"{label} is the phrase you selected from your notes. "
            "Use the reference links to explore it further."
        )
    )
    return ConceptDetailsResult(
        label=label,
        definition=definition,
        key_points=[],
        sources=sources,
        confidence=0.0,
        warnings=list(warnings),
    )
