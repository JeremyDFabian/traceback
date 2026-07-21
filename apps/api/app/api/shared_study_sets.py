"""Small public-study-set store used by the shareable Traceback deck links."""

import json
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import get_settings

router = APIRouter(tags=["shared study sets"])


class SharedStudySetRequest(BaseModel):
    """The browser sends typed notes and cards, never the original image scans."""

    study_set: dict = Field(..., max_length=1_000_000)
    cards: list[dict] = Field(default_factory=list, max_length=200)


class SharedStudySetResponse(BaseModel):
    id: str
    study_set: dict
    cards: list[dict]


def _share_directory() -> Path:
    directory = get_settings().storage_dir / "shared-study-sets"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


@router.post("/shared-study-sets", response_model=SharedStudySetResponse, status_code=status.HTTP_201_CREATED)
def create_shared_study_set(payload: SharedStudySetRequest) -> SharedStudySetResponse:
    share_id = uuid4().hex
    record = {"study_set": payload.study_set, "cards": payload.cards}
    (_share_directory() / f"{share_id}.json").write_text(
        json.dumps(record), encoding="utf-8"
    )
    return SharedStudySetResponse(id=share_id, **record)


@router.get("/shared-study-sets/{share_id}", response_model=SharedStudySetResponse)
def get_shared_study_set(share_id: str) -> SharedStudySetResponse:
    path = _share_directory() / f"{share_id}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Shared study set not found")
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
        return SharedStudySetResponse(id=share_id, **record)
    except (OSError, json.JSONDecodeError, TypeError) as error:
        raise HTTPException(status_code=500, detail="Shared study set could not be opened") from error
