"""
Recommendation generation endpoints.
"""

import time
import structlog
from fastapi import APIRouter, Request, HTTPException

from app.schemas import (
    GenerateRecommendationsRequest,
    GenerateRecommendationsResponse,
)
from app.core.config import settings

router = APIRouter()
logger = structlog.get_logger()


@router.post(
    "/recommendations/generate",
    response_model=GenerateRecommendationsResponse,
)
async def generate_recommendations(
    request: Request,
    body: GenerateRecommendationsRequest,
) -> GenerateRecommendationsResponse:
    """
    Generate personalized learning recommendations for a user.
    
    Uses ML models combined with rule-based scoring to produce
    ranked recommendations based on:
    - User skill gaps
    - Career goals
    - Market signals and trends
    - Learning preferences
    """
    start_time = time.time()
    
    model_service = request.app.state.model_service
    if not model_service or not model_service.is_initialized:
        raise HTTPException(
            status_code=503,
            detail="ML models not initialized"
        )
    
    logger.info(
        "Generating recommendations",
        user_id=body.user_context.user_id,
        skill_gaps_count=len(body.skill_gaps),
        signals_count=len(body.recent_signals),
    )
    
    try:
        recommendations = await model_service.generate_recommendations(
            user_context=body.user_context,
            skill_gaps=body.skill_gaps,
            market_signals=body.recent_signals,
            max_recommendations=body.max_recommendations,
        )
        
        # Filter by content types if specified
        if body.filter_content_types:
            recommendations = [
                r for r in recommendations
                if r.content_type in body.filter_content_types
            ]
        
        # Filter by minimum confidence
        recommendations = [
            r for r in recommendations
            if r.confidence_score >= body.min_confidence
        ]
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(
            "Recommendations generated",
            user_id=body.user_context.user_id,
            count=len(recommendations),
            processing_time_ms=processing_time,
        )
        
        return GenerateRecommendationsResponse(
            recommendations=recommendations,
            generation_method="hybrid" if model_service.recommendation_model else "rule_based",
            model_version=settings.VERSION,
            processing_time_ms=processing_time,
            user_id=body.user_context.user_id,
        )
        
    except Exception as e:
        logger.error(
            "Failed to generate recommendations",
            user_id=body.user_context.user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate recommendations: {str(e)}"
        )


@router.post("/recommendations/batch")
async def batch_generate_recommendations(
    request: Request,
    user_ids: list[str],
):
    """
    Generate recommendations for multiple users in batch.
    
    Useful for scheduled recommendation refresh jobs.
    """
    model_service = request.app.state.model_service
    if not model_service:
        raise HTTPException(status_code=503, detail="ML models not initialized")
    
    # In production, this would queue batch processing
    return {
        "status": "queued",
        "user_count": len(user_ids),
        "message": "Batch recommendation generation has been queued",
    }
