"""
ML Recommendation Service - Main Application
"""

import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import recommendations, skill_gaps, trends, health
from app.core.config import settings
from app.core.logging import setup_logging
from app.services.model_service import ModelService

# Setup logging
setup_logging()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting ML Recommendation Service", version=settings.VERSION)
    
    # Initialize model service and load models
    model_service = ModelService()
    await model_service.initialize()
    app.state.model_service = model_service
    
    logger.info("ML models loaded successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down ML Recommendation Service")
    await model_service.cleanup()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="ML Recommendation Service",
        description="Machine learning-powered learning recommendations for SkillPod",
        version=settings.VERSION,
        lifespan=lifespan,
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(health.router, tags=["Health"])
    app.include_router(recommendations.router, prefix="/api/v1", tags=["Recommendations"])
    app.include_router(skill_gaps.router, prefix="/api/v1", tags=["Skill Gaps"])
    app.include_router(trends.router, prefix="/api/v1", tags=["Trends"])
    
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
