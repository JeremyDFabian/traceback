from pydantic import BaseModel, Field


class ConceptDetailsRequest(BaseModel):
    label: str = Field(min_length=1)
    transcription: str | None = None


class ConceptSource(BaseModel):
    title: str
    url: str


class ConceptDetailsResult(BaseModel):
    label: str
    definition: str
    key_points: list[str] = Field(default_factory=list)
    sources: list[ConceptSource] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)


class GeneratedConceptDetails(BaseModel):
    definition: str
    key_points: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)