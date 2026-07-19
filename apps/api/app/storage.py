import json
import shutil
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import UUID

from fastapi import UploadFile
from pydantic import BaseModel


class SupabaseStorage:
    """Small server-side adapter for Supabase Storage's object API."""

    def __init__(self, base_url: str, service_role_key: str, bucket: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.service_role_key = service_role_key
        self.bucket = bucket

    def _request(self, method: str, storage_key: str, body: bytes | None = None) -> bytes:
        encoded_key = quote(storage_key, safe="/")
        request = Request(
            f"{self.base_url}/storage/v1/object/{self.bucket}/{encoded_key}",
            data=body,
            method=method,
            headers={
                "Authorization": f"Bearer {self.service_role_key}",
                "apikey": self.service_role_key,
                "Content-Type": "application/octet-stream",
                "x-upsert": "true",
            },
        )
        try:
            with urlopen(request, timeout=30) as response:
                return response.read()
        except HTTPError as error:
            raise RuntimeError(f"Supabase Storage request failed with HTTP {error.code}") from error

    def save(self, storage_key: str, content: bytes) -> str:
        self._request("POST", storage_key, content)
        return storage_key

    def load(self, storage_key: str) -> bytes:
        return self._request("GET", storage_key)


def get_object_storage(settings: Any) -> SupabaseStorage | None:
    """Use Supabase Storage when both server-side settings are configured."""
    supabase_url = getattr(settings, "supabase_url", None)
    service_role_key = getattr(settings, "supabase_service_role_key", None)
    if not supabase_url or not service_role_key:
        return None
    key = (
        service_role_key.get_secret_value()
        if hasattr(service_role_key, "get_secret_value")
        else str(service_role_key)
    )
    return SupabaseStorage(
        base_url=supabase_url,
        service_role_key=key,
        bucket=getattr(settings, "supabase_storage_bucket", "traceback-files"),
    )


def iter_file_chunks(file_object: Any, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
    """Yield bounded chunks when a caller needs to stream a large upload."""
    while chunk := file_object.read(chunk_size):
        yield chunk


def save_upload(
    storage_dir: Path,
    session_id: UUID,
    category: str,
    upload: UploadFile,
    object_storage: SupabaseStorage | None = None,
) -> str:
    suffix = Path(upload.filename or "").suffix.lower()
    storage_key = Path(category) / f"{session_id}{suffix}"
    if object_storage is not None:
        object_storage.save(storage_key.as_posix(), upload.file.read())
        (storage_dir / ".cache" / storage_key).unlink(missing_ok=True)
    else:
        destination = storage_dir / storage_key
        destination.parent.mkdir(parents=True, exist_ok=True)

        with destination.open("wb") as output_file:
            shutil.copyfileobj(upload.file, output_file)

    return storage_key.as_posix()


def save_json(
    storage_dir: Path,
    storage_key: str,
    value: BaseModel,
    object_storage: SupabaseStorage | None = None,
) -> str:
    content = json.dumps(value.model_dump(mode="json"), indent=2).encode() + b"\n"
    if object_storage is not None:
        object_storage.save(storage_key, content)
        (storage_dir / ".cache" / storage_key).unlink(missing_ok=True)
        return storage_key

    destination = storage_dir / storage_key
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    return storage_key


def load_json(
    storage_dir: Path,
    storage_key: str,
    object_storage: SupabaseStorage | None = None,
) -> dict[str, Any]:
    if object_storage is not None:
        return json.loads(object_storage.load(storage_key).decode())
    source = storage_dir / storage_key
    return json.loads(source.read_text(encoding="utf-8"))


def materialize_file(
    storage_dir: Path,
    storage_key: str,
    object_storage: SupabaseStorage | None = None,
) -> Path:
    """Return a local path for parsers that need filesystem access."""
    if object_storage is None:
        return storage_dir / storage_key

    cache_path = storage_dir / ".cache" / storage_key
    if not cache_path.is_file():
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(object_storage.load(storage_key))
    return cache_path
