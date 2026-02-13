"""
ML Recommendation Service - Main Application

This service owns all AI/ML operations for the Skillancer platform:
- Proposal intelligence (analysis, suggestions, scoring, improvement)
- Rate optimization (market rates, win probability, strategy selection)
- Career coaching (analysis, recommendations, goals, earnings prediction)
- Market insights (demand, trends, skill gaps, competition)
- LLM proxy (centralized LLM access for internal services)
- Learning recommendations, skill gap analysis, trend forecasting

Internal /ai/* routes are protected by service-to-service auth.
Public /api/v1/* routes serve the existing recommendations/trends API.
"""

import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import recommendations, skill_gaps, trends, health
from app.api.routes.proposal_routes import router as proposal_router
from app.api.routes.rate_routes import router as rate_router
from app.api.routes.career_routes import router as career_router
from app.api.routes.llm_routes import router as llm_router
from app.api.routes.market_routes import router as market_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.middleware.service_auth import ServiceAuthMiddleware
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
        description=(
            "AI/ML engine for Skillancer — proposals, rates, career coaching, "
            "market insights, and learning recommendations."
        ),
        version=settings.VERSION,
        lifespan=lifespan,
    )

    # Service-to-service auth middleware (must be added before CORS)
    app.add_middleware(ServiceAuthMiddleware)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Public routers (no service auth required)
    app.include_router(health.router, tags=["Health"])
    app.include_router(recommendations.router, prefix="/api/v1", tags=["Recommendations"])
    app.include_router(skill_gaps.router, prefix="/api/v1", tags=["Skill Gaps"])
    app.include_router(trends.router, prefix="/api/v1", tags=["Trends"])

    # Internal AI routers (protected by ServiceAuthMiddleware on /ai/* prefix)
    app.include_router(proposal_router, tags=["Proposal AI"])
    app.include_router(rate_router, tags=["Rate Optimizer"])
    app.include_router(career_router, tags=["Career Coach"])
    app.include_router(llm_router, tags=["LLM Proxy"])
    app.include_router(market_router, tags=["Market Insights"])

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
