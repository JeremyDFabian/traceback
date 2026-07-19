import pytest

from app.core.config import get_settings


@pytest.fixture(autouse=True)
def configure_test_settings(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://test:test@localhost:5432/traceback",
    )
    monkeypatch.setenv("ANALYSIS_ENGINE", "local")
    monkeypatch.setenv("OCR_ENGINE", "mock")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
