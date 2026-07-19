from collections.abc import Generator
from typing import Any

import psycopg

from app.core.config import get_settings


def get_connection() -> Generator[psycopg.Connection[Any], None, None]:
    with psycopg.connect(get_settings().database_url) as connection:
        yield connection
