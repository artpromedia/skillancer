"""
Trend forecasting endpoints.
"""

import time
import structlog
from fastapi import APIRouter, Request, HTTPException, Query

from app.schemas import (
    ForecastTrendRequest,
    ForecastTrendResponse,
)
from app.core.config import settings

router = APIRouter()
logger = structlog.get_logger()


@router.get(
    "/trends/forecast/{skill_id}",
    response_model=ForecastTrendResponse,
)
async def forecast_skill_trend(
    request: Request,
    skill_id: str,
    periods_ahead: int = Query(default=12, ge=1, le=52),
    include_confidence_intervals: bool = Query(default=True),
) -> ForecastTrendResponse:
    """
    Forecast demand trend for a specific skill.
    
    Returns predicted demand scores for future periods
    with confidence intervals.
    """
    start_time = time.time()
    
    model_service = request.app.state.model_service
    if not model_service or not model_service.is_initialized:
        raise HTTPException(
            status_code=503,
            detail="ML models not initialized"
        )
    
    logger.info(
        "Forecasting skill trend",
        skill_id=skill_id,
        periods_ahead=periods_ahead,
    )
    
    try:
        forecast = await model_service.forecast_trend(
            skill_id=skill_id,
            periods_ahead=periods_ahead,
        )
        
        # Remove confidence intervals if not requested
        if not include_confidence_intervals:
            for f in forecast.forecasts:
                f.pop("lower_bound", None)
                f.pop("upper_bound", None)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(
            "Trend forecast complete",
            skill_id=skill_id,
            trend_direction=forecast.trend_direction.value,
            processing_time_ms=processing_time,
        )
        
        return ForecastTrendResponse(
            forecast=forecast,
            model_version=settings.VERSION,
            processing_time_ms=processing_time,
        )
        
    except Exception as e:
        logger.error(
            "Failed to forecast trend",
            skill_id=skill_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to forecast trend: {str(e)}"
        )


@router.post("/trends/analyze")
async def analyze_market_trends(
    request: Request,
    skill_ids: list[str],
):
    """
    Analyze market trends for multiple skills.
    
    Returns comparative trend analysis.
    """
    start_time = time.time()
    
    model_service = request.app.state.model_service
    if not model_service:
        raise HTTPException(status_code=503, detail="ML models not initialized")
    
    analyses = []
    for skill_id in skill_ids[:20]:  # Limit to 20 skills
        forecast = await model_service.forecast_trend(
            skill_id=skill_id,
            periods_ahead=6,
        )
        analyses.append({
            "skill_id": skill_id,
            "current_demand": forecast.current_demand_score,
            "trend_direction": forecast.trend_direction.value,
            "6_month_outlook": forecast.forecasts[-1]["predicted_demand"] if forecast.forecasts else None,
        })
    
    processing_time = int((time.time() - start_time) * 1000)
    
    return {
        "analyses": analyses,
        "processing_time_ms": processing_time,
    }


@router.get("/trends/top")
async def get_top_trending_skills(
    request: Request,
    limit: int = Query(default=10, ge=1, le=50),
):
    """
    Get top trending skills based on demand growth.
    """
    # Placeholder - would query trend data in production
    trending = [
        {"skill_id": f"skill-{i}", "skill_name": f"Trending Skill {i}", "growth_rate": 15 - i}
        for i in range(1, min(limit + 1, 11))
    ]
    
    return {"trending_skills": trending}
