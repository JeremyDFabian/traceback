from app.core.config import Settings


def test_ocr_analysis_enabled_when_engine_is_not_mock() -> None:
    assert not Settings(ocr_engine="mock").ocr_analysis_enabled
    assert Settings(ocr_engine="easyocr").ocr_analysis_enabled
    assert Settings(ocr_engine="paddleocr").ocr_analysis_enabled
