import re

from app.schemas.notebook_analysis import NotebookRegion

MAX_HIGHLIGHTS = 8
MAX_HIGHLIGHT_WORDS = 5
MIN_HIGHLIGHT_CONFIDENCE = 0.65
GENERIC_LABELS = {
    "content",
    "definition",
    "heading",
    "list",
    "notes",
    "subheading",
}
SENTENCE_VERBS = {
    "are",
    "be",
    "cause",
    "causes",
    "did",
    "do",
    "does",
    "had",
    "has",
    "have",
    "help",
    "helps",
    "is",
    "make",
    "makes",
    "mean",
    "means",
    "need",
    "needs",
    "occur",
    "occurs",
    "produce",
    "produces",
    "release",
    "releases",
    "store",
    "stores",
    "use",
    "uses",
    "was",
    "were",
}
HEURISTIC_PHRASE_PATTERN = re.compile(
    r"\b(?:[A-Z][A-Za-z]{2,}|[A-Z]{2,})(?:\s+(?:[A-Z][A-Za-z]{2,}|[A-Z]{2,})){0,3}\b"
)
HEURISTIC_STOP_PHRASES = {"chapter", "content", "notes", "page", "the"}


def normalize_phrase(value: str) -> str:
    return " ".join(value.split())


def looks_like_full_sentence(phrase: str, transcription: str) -> bool:
    if phrase != transcription:
        return False

    words = [word.casefold().strip(".,:;!?()[]{}") for word in transcription.split()]
    return (
        transcription.endswith((".", "!", "?"))
        or len(words) > MAX_HIGHLIGHT_WORDS
        or any(word in SENTENCE_VERBS for word in words)
    )


def is_valid_highlight_phrase(phrase: str, typed_text: str) -> bool:
    normalized_phrase = normalize_phrase(phrase)
    if not normalized_phrase or len(normalized_phrase.split()) > MAX_HIGHLIGHT_WORDS:
        return False

    phrase_pattern = r"\s+".join(
        re.escape(word) for word in normalized_phrase.split()
    )
    return bool(re.search(rf"\b{phrase_pattern}\b", typed_text, re.IGNORECASE))


def filter_interactive_regions(
    regions: list[NotebookRegion], typed_text: str
) -> list[NotebookRegion]:
    """Keep only concise, verified phrases that can safely be highlighted."""
    retained_regions: list[NotebookRegion] = []
    seen_phrases: set[str] = set()

    for region in regions:
        highlight_text = normalize_phrase(region.highlight_text)
        transcription = normalize_phrase(region.transcription)
        label = normalize_phrase(region.label)
        phrase_key = highlight_text.casefold()

        is_full_sentence = looks_like_full_sentence(highlight_text, transcription)
        if (
            region.confidence < MIN_HIGHLIGHT_CONFIDENCE
            or phrase_key in seen_phrases
            or is_full_sentence
            or not is_valid_highlight_phrase(highlight_text, typed_text)
        ):
            continue

        if (
            not label
            or label.casefold() in GENERIC_LABELS
            or len(label.split()) > MAX_HIGHLIGHT_WORDS
        ):
            label = highlight_text

        retained_regions.append(
            region.model_copy(
                update={
                    "label": label,
                    "highlight_text": highlight_text,
                    "explanation": region.explanation
                    or f"{label} is a key topic in this notebook page.",
                    "trusted_source_queries": region.trusted_source_queries
                    or [label],
                }
            )
        )
        seen_phrases.add(phrase_key)
        if len(retained_regions) == MAX_HIGHLIGHTS:
            break

    return retained_regions


def build_heuristic_highlights(
    ocr_regions: list[NotebookRegion], typed_text: str
) -> list[NotebookRegion]:
    """Recover useful proper-noun/topic phrases when remote analysis is unavailable."""
    retained_regions: list[NotebookRegion] = []
    seen_phrases: set[str] = set()

    for region in ocr_regions:
        for match in HEURISTIC_PHRASE_PATTERN.finditer(region.transcription):
            phrase = normalize_phrase(match.group(0)).removesuffix(" CHAPTER")
            phrase_key = phrase.casefold()
            if (
                phrase_key in HEURISTIC_STOP_PHRASES
                or phrase_key in seen_phrases
                or not is_valid_highlight_phrase(phrase, typed_text)
            ):
                continue

            retained_regions.append(
                region.model_copy(
                    update={
                        "label": phrase,
                        "highlight_text": phrase,
                        "type": "concept",
                        "explanation": (
                            f"{phrase} is a key topic detected in this notebook page."
                        ),
                        "trusted_source_queries": [phrase],
                    }
                )
            )
            seen_phrases.add(phrase_key)
            if len(retained_regions) == MAX_HIGHLIGHTS:
                return retained_regions

    return retained_regions
