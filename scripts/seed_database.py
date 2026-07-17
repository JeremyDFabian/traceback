from pathlib import Path

import psycopg
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        extra="ignore",
    )


def main() -> None:
    settings = Settings()  # type: ignore[call-arg]
    seed_path = Path(__file__).resolve().parents[1] / "supabase" / "seed.sql"

    with psycopg.connect(settings.database_url) as connection:
        connection.execute(seed_path.read_text(encoding="utf-8"))

    print("Development database seeded.")


if __name__ == "__main__":
    main()
