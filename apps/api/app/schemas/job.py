from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

JobStatus = Literal["queued", "processing", "completed", "failed"]


class JobCreateRequest(BaseModel):
    stage: str = Field(min_length=1)


class JobResponse(BaseModel):
    id: UUID
    session_id: UUID
    status: JobStatus
    stage: str
    progress: int
    result_reference: str | None
    error_code: str | None
    error_message: str | None
    retryable: bool
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
