"""
Skill gap analysis endpoints.
"""

import time
import structlog
from fastapi import APIRouter, Request, HTTPException

from app.schemas import (
    AnalyzeSkillGapsRequest,
    AnalyzeSkillGapsResponse,
)

router = APIRouter()
logger = structlog.get_logger()


@router.post(
    "/skill-gaps/analyze",
    response_model=AnalyzeSkillGapsResponse,
)
async def analyze_skill_gaps(
    request: Request,
    body: AnalyzeSkillGapsRequest,
) -> AnalyzeSkillGapsResponse:
    """
    Analyze skill gaps for a user based on their current skills,
    target skills, and market signals.
    
    Returns prioritized skill gaps with recommended actions.
    """
    start_time = time.time()
    
    model_service = request.app.state.model_service
    if not model_service or not model_service.is_initialized:
        raise HTTPException(
            status_code=503,
            detail="ML models not initialized"
        )
    
    logger.info(
        "Analyzing skill gaps",
        user_id=body.user_context.user_id,
        target_skills_count=len(body.target_skills),
    )
    
    try:
        skill_gaps = await model_service.analyze_skill_gaps(
            user_context=body.user_context,
            target_skills=body.target_skills,
            market_signals=body.market_signals,
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Build summary
        summary = {
            "total_gaps": len(skill_gaps),
            "critical_count": sum(1 for g in skill_gaps if g.priority.value == "CRITICAL"),
            "high_count": sum(1 for g in skill_gaps if g.priority.value == "HIGH"),
            "medium_count": sum(1 for g in skill_gaps if g.priority.value == "MEDIUM"),
            "low_count": sum(1 for g in skill_gaps if g.priority.value == "LOW"),
            "avg_gap_score": sum(g.gap_score for g in skill_gaps) / len(skill_gaps) if skill_gaps else 0,
        }
        
        # Market context
        market_context = None
        if body.include_market_context and skill_gaps:
            market_context = {
                "avg_market_demand": sum(g.market_demand_score for g in skill_gaps) / len(skill_gaps),
                "high_demand_skills": [
                    g.skill_name for g in skill_gaps if g.market_demand_score > 75
                ],
            }
        
        logger.info(
            "Skill gap analysis complete",
            user_id=body.user_context.user_id,
            gaps_found=len(skill_gaps),
            processing_time_ms=processing_time,
        )
        
        return AnalyzeSkillGapsResponse(
            skill_gaps=skill_gaps,
            summary=summary,
            market_context=market_context,
            processing_time_ms=processing_time,
        )
        
    except Exception as e:
        logger.error(
            "Failed to analyze skill gaps",
            user_id=body.user_context.user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze skill gaps: {str(e)}"
        )


@router.post("/skill-gaps/predict")
async def predict_skill_gap_impact(
    request: Request,
    skill_ids: list[str],
):
    """
    Predict the career impact of filling specific skill gaps.
    """
    model_service = request.app.state.model_service
    if not model_service:
        raise HTTPException(status_code=503, detail="ML models not initialized")
    
    # Placeholder for impact prediction
    predictions = []
    for skill_id in skill_ids:
        predictions.append({
            "skill_id": skill_id,
            "estimated_salary_increase_percent": 8.5,
            "estimated_job_match_increase": 15,
            "confidence": 0.7,
        })
    
    return {"predictions": predictions}
