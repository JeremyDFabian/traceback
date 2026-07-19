from typing import Literal

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)


MarkerType = Literal["star", "question", "highlight", "circle"]
RegionType = Literal["concept", "definition", "question", "example", "other"]


class Region(BaseModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    transcription: str = Field(min_length=1)
    type: RegionType
    bbox: BoundingBox
    markers: list[MarkerType] = []
    confidence: float = Field(ge=0, le=1)


class Relationship(BaseModel):
    id: str = Field(min_length=1)
    source_region_id: str = Field(min_length=1)
    target_region_id: str = Field(min_length=1)
    label: str | None = None
    confidence: float = Field(ge=0, le=1)


class AnalysisResult(BaseModel):
    page_summary: str
    regions: list[Region]
    relationships: list[Relationship]
