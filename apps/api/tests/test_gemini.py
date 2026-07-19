from pydantic import SecretStr

from app.core.config import Settings
from app.services.notebook_analysis.gemini import (
    analyze_notebook_with_gemini,
    gemini_response_schema,
)


def test_gemini_analysis_uses_local_fallback_without_api_key() -> None:
    analysis = analyze_notebook_with_gemini(
        b"not-an-image",
        Settings(
            database_url="postgresql://test:test@localhost:5432/traceback",
            analysis_engine="gemini",
            gemini_api_key=SecretStr(""),
        ),
    )

    assert analysis.result is None
    assert analysis.warnings == ["gemini_api_key_missing_using_local_fallback"]


def test_gemini_response_schema_omits_unsupported_exclusive_minimum() -> None:
    def contains_exclusive_minimum(value: object) -> bool:
        if isinstance(value, dict):
            return "exclusiveMinimum" in value or any(
                contains_exclusive_minimum(child) for child in value.values()
            )
        if isinstance(value, list):
            return any(contains_exclusive_minimum(child) for child in value)
        return False

    assert not contains_exclusive_minimum(gemini_response_schema())
