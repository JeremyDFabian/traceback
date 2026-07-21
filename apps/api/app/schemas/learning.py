from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.analysis import BoundingBox, Region, Relationship


class ApprovedNotebookPage(BaseModel):
    page_id: str = Field(min_length=1)
    page_summary: str
    typed_text: str
    regions: list[Region]
    relationships: list[Relationship]


class ApprovedNotebookPages(BaseModel):
    pages: list[ApprovedNotebookPage] = []

    @model_validator(mode="after")
    def require_unique_page_ids(self) -> "ApprovedNotebookPages":
        page_ids = [page.page_id for page in self.pages]
        if len(page_ids) != len(set(page_ids)):
            raise ValueError("page IDs must be unique")
        return self


class GraphSource(BaseModel):
    page_id: str
    region_id: str
    excerpt: str
    bbox: BoundingBox


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    confidence: float = Field(default=1.0, ge=0, le=1)
    sources: list[GraphSource] = []


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str | None
    confidence: float = Field(default=1.0, ge=0, le=1)
    review_required: bool = False


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ConfirmPageResponse(BaseModel):
    page: ApprovedNotebookPage
    graph_status: Literal["ready", "pending"]


class FlashcardSuggestion(BaseModel):
    id: str
    region_id: str
    question: str
    answer: str
    source_slide: int | None
    status: Literal["suggested", "approved", "rejected"]
