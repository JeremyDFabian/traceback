from fastapi import FastAPI

from app.api.analysis import router as analysis_router
from app.api.concept_details import router as concept_details_router
from app.api.decks import router as decks_router
from app.api.flashcards import router as flashcards_router
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.learning import router as learning_router
from app.api.matches import router as matches_router
from app.api.notebook_analysis import router as notebook_analysis_router
from app.api.sessions import router as sessions_router
from app.api.uploads import router as uploads_router

app = FastAPI(
    title="Traceback API",
    version="0.1.0",
    description="API for turning notebook pages into interactive study surfaces.",
)

app.include_router(health_router, prefix="/api")
app.include_router(concept_details_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(learning_router, prefix="/api")
app.include_router(matches_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(decks_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")
app.include_router(flashcards_router, prefix="/api")
app.include_router(notebook_analysis_router, prefix="/api")
