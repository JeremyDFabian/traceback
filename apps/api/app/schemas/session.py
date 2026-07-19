from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class SessionResponse(BaseModel):
    id: UUID
    status: Literal["created", "processing", "ready", "failed"]
    created_at: datetime
    updated_at: datetime
