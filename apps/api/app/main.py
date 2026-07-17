from fastapi import FastAPI

from app.api.health import router as health_router

app = FastAPI(
    title="Traceback API",
    version="0.1.0",
    description="API for turning notebook pages into interactive study surfaces.",
)
app.include_router(health_router, prefix="/api")
