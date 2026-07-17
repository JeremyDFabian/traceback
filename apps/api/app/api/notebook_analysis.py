from fastapi import APIRouter

from app.schemas.notebook_analysis import NotebookAnalysisRequest, NotebookAnalysisResult
from app.services.notebook_analysis.analyzer import analyze_notebook_page

router = APIRouter(prefix="/api/notebook-analysis", tags=["notebook-analysis"])


@router.post("", response_model=NotebookAnalysisResult)
async def analyze_notebook_page_route(
    request: NotebookAnalysisRequest,
) -> NotebookAnalysisResult:
    return await analyze_notebook_page(request)
