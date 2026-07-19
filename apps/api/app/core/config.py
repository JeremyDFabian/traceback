from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    storage_dir: Path = Path(".data/uploads")
    supabase_url: str | None = None
    supabase_service_role_key: SecretStr | None = None
    supabase_storage_bucket: str = "traceback-files"
    analysis_engine: Literal["local", "gemini", "openai"] = "local"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3-flash-preview"
    openai_api_key: SecretStr | None = None
    openai_vision_model: str = "gpt-5.6-terra"
    ocr_engine: Literal["mock", "easyocr", "paddleocr"] = "mock"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[4] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def gemini_analysis_enabled(self) -> bool:
        return self.analysis_engine == "gemini"

    @property
    def openai_analysis_enabled(self) -> bool:
        return self.analysis_engine == "openai"

    @property
    def remote_vision_enabled(self) -> bool:
        return self.gemini_analysis_enabled or self.openai_analysis_enabled

    @property
    def ocr_analysis_enabled(self) -> bool:
        return self.ocr_engine != "mock"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
