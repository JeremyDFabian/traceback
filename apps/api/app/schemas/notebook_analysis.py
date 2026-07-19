from typing import Literal

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width: float = Field(gt=0.0, le=1.0)
    height: float = Field(gt=0.0, le=1.0)


class NotebookMarker(BaseModel):
    id: str
    type: Literal["star", "question", "highlight", "circle"]
    bbox: BoundingBox | None = None
    region_id: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    uncertainty_note: str | None = None


class NotebookRegion(BaseModel):
    id: str
    label: str
    highlight_text: str = ""
    transcription: str
    type: Literal["concept", "definition", "question", "example", "other"]
    bbox: BoundingBox
    markers: list[Literal["star", "question", "highlight", "circle"]] = Field(
        default_factory=list[Literal["star", "question", "highlight", "circle"]]
    )
    confidence: float = Field(ge=0.0, le=1.0)
    explanation: str = ""
    trusted_source_queries: list[str] = Field(default_factory=list[str])
    uncertainty_note: str | None = None


class NotebookRelationship(BaseModel):
    id: str
    source_region_id: str
    target_region_id: str
    label: str | None = None
    type: Literal["arrow", "line", "spatial", "unknown"] = "arrow"
    confidence: float = Field(ge=0.0, le=1.0)
    uncertainty_note: str | None = None


class NotebookAnalysisRequest(BaseModel):
    image_url: str | None = None
    image_base64: str | None = None
    manual_crop_bbox: BoundingBox | None = None


class NotebookAnalysisResult(BaseModel):
    page_summary: str = "Notebook analysis"
    typed_text: str = ""
    regions: list[NotebookRegion] = Field(default_factory=list[NotebookRegion])
    relationships: list[NotebookRelationship] = Field(default_factory=list[NotebookRelationship])
    markers: list[NotebookMarker] = Field(default_factory=list[NotebookMarker])
    warnings: list[str] = Field(default_factory=list[str])
    confidence: float = Field(ge=0.0, le=1.0)
