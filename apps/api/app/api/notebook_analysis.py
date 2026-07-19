from fastapi import APIRouter, HTTPException, status

from app.schemas.notebook_analysis import NotebookAnalysisRequest, NotebookAnalysisResult
from app.services.notebook_analysis.analyzer import NotebookAnalysisError, analyze_notebook_page

router = APIRouter(prefix="/notebook-analysis", tags=["notebook-analysis"])

@router.post("", response_model=NotebookAnalysisResult)
async def analyze_notebook_page_route(
    request: NotebookAnalysisRequest,
) -> NotebookAnalysisResult:
    try:
        return await analyze_notebook_page(request)
    except NotebookAnalysisError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
