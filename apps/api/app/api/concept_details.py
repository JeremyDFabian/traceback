from fastapi import APIRouter

from app.schemas.concept_details import ConceptDetailsRequest, ConceptDetailsResult
from app.services.concept_details import get_concept_details

router = APIRouter(prefix="/concept-details", tags=["concept-details"])


@router.post("", response_model=ConceptDetailsResult)
async def concept_details(request: ConceptDetailsRequest) -> ConceptDetailsResult:
    return get_concept_details(request)