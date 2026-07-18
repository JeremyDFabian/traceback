from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    storage_dir: Path = Path(".data/uploads")
    ocr_engine: Literal["mock", "easyocr", "paddleocr"] = "mock"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def ocr_analysis_enabled(self) -> bool:
        return self.ocr_engine != "mock"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]