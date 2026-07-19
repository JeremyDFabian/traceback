from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class UploadResponse(BaseModel):
    session_id: UUID
    kind: Literal["deck", "notebook_page"]
    storage_path: str
