from app.core.config import Settings


def test_ocr_analysis_enabled_when_engine_is_not_mock() -> None:
    database_url = "postgresql://test:test@localhost:5432/traceback"

    assert not Settings(
        database_url=database_url,
        ocr_engine="mock",
    ).ocr_analysis_enabled
    assert Settings(
        database_url=database_url,
        ocr_engine="easyocr",
    ).ocr_analysis_enabled
    assert Settings(
        database_url=database_url,
        ocr_engine="paddleocr",
    ).ocr_analysis_enabled