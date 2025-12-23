"""
Health check endpoints.
"""

import time
from fastapi import APIRouter, Request

from app.schemas import HealthResponse
from app.core.config import settings

router = APIRouter()

_start_time = time.time()


@router.get("/health", response_model=HealthResponse)
async def health_check(request: Request) -> HealthResponse:
    """Basic health check endpoint."""
    model_service = request.app.state.model_service
    
    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        models_loaded=model_service.is_initialized if model_service else False,
        uptime_seconds=int(time.time() - _start_time),
    )


@router.get("/ready")
async def readiness_check(request: Request):
    """Readiness check for Kubernetes."""
    model_service = request.app.state.model_service
    
    if model_service and model_service.is_initialized:
        return {"status": "ready"}
    
    return {"status": "not ready", "reason": "Models not initialized"}


@router.get("/live")
async def liveness_check():
    """Liveness check for Kubernetes."""
    return {"status": "alive"}
