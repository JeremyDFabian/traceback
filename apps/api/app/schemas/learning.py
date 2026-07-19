from typing import Literal

from pydantic import BaseModel


class GraphNode(BaseModel):
    id: str
    label: str
    type: str


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str | None


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class FlashcardSuggestion(BaseModel):
    id: str
    region_id: str
    question: str
    answer: str
    source_slide: int | None
    status: Literal["suggested", "approved", "rejected"]
