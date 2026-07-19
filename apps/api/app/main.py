from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.flashcards import router as flashcards_router
from app.api.health import router as health_router
from app.config import get_settings

app = FastAPI(
    title="Traceback API",
    version="0.1.0",
    description="API for turning notebook pages into interactive study surfaces.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().web_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router, prefix="/api")
app.include_router(flashcards_router, prefix="/api")
