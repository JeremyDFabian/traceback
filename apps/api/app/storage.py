import json
import shutil
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import UploadFile
from pydantic import BaseModel


def save_upload(
    storage_dir: Path,
    session_id: UUID,
    category: str,
    upload: UploadFile,
) -> str:
    suffix = Path(upload.filename or "").suffix.lower()
    storage_key = Path(category) / f"{session_id}{suffix}"
    destination = storage_dir / storage_key
    destination.parent.mkdir(parents=True, exist_ok=True)

    with destination.open("wb") as output_file:
        shutil.copyfileobj(upload.file, output_file)

    return storage_key.as_posix()


def save_json(storage_dir: Path, storage_key: str, value: BaseModel) -> str:
    destination = storage_dir / storage_key
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(value.model_dump(mode="json"), indent=2) + "\n",
        encoding="utf-8",
    )
    return storage_key


def load_json(storage_dir: Path, storage_key: str) -> dict[str, Any]:
    source = storage_dir / storage_key
    return json.loads(source.read_text(encoding="utf-8"))
