"""
Rate Optimizer Routes
API endpoints for AI-powered rate optimization
Sprint M7: AI Work Assistant
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
import structlog

from app.api.rate_optimizer import RateOptimizerService

router = APIRouter(prefix="/ai/rate", tags=["Rate Optimizer"])
logger = structlog.get_logger()


# =============================================================================
# REQUEST/RESPONSE SCHEMAS
# =============================================================================

class OptimizeRateRequest(BaseModel):
    """Request to get optimal rate for a job"""
    job_id: str
    job_title: str
    job_description: str
    skills_required: List[str]
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    duration: Optional[str] = None
    freelancer_profile: dict = Field(
        ...,
        description="Freelancer skills, experience, and rate history"
    )
    strategy: str = Field(
        default="balanced",
        description="competitive, balanced, or premium"
    )


class OptimizeRateResponse(BaseModel):
    """Response with optimal rate recommendation"""
    recommended_rate: float
    rate_range: dict = Field(
        ...,
        description="min and max viable rates"
    )
    win_probability: float
    expected_value: float
    confidence: float
    reasoning: List[str]
    alternative_strategies: List[dict]
    market_position: dict


class AnalyzeRateRequest(BaseModel):
    """Request to analyze a proposed rate"""
    job_id: str
    proposed_rate: float
    job_skills: List[str]
    freelancer_profile: dict


class AnalyzeRateResponse(BaseModel):
    """Response with rate analysis"""
    proposed_rate: float
    win_probability: float
    market_position: str
    market_percentile: int
    competitive_analysis: dict
    recommendations: List[str]
    expected_value: float


class MarketRateRequest(BaseModel):
    """Request for market rate data"""
    skill: str
    experience_level: Optional[str] = None
    location: Optional[str] = None


class MarketRateResponse(BaseModel):
    """Response with market rate data"""
    skill: str
    experience_level: str
    percentile_25: float
    percentile_50: float
    percentile_75: float
    percentile_90: float
    sample_size: int
    trend: str
    last_updated: str


class RateFeedbackRequest(BaseModel):
    """Request to record rate outcome"""
    job_id: str
    freelancer_id: str
    proposed_rate: float
    outcome: str = Field(
        ...,
        description="won, lost, or withdrawn"
    )
    client_feedback: Optional[str] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/optimize", response_model=OptimizeRateResponse)
async def optimize_rate(
    request: OptimizeRateRequest,
    background_tasks: BackgroundTasks,
) -> OptimizeRateResponse:
    """
    Get optimal rate recommendation for a job.
    
    Considers:
    - Freelancer skills and experience
    - Job requirements and complexity
    - Client budget signals
    - Market rates for similar work
    - Historical win rates at different prices
    """
    import time
    start_time = time.time()
    
    logger.info(
        "Optimizing rate",
        job_id=request.job_id,
        freelancer_id=request.freelancer_profile.get("user_id"),
        strategy=request.strategy,
    )
    
    try:
        service = RateOptimizerService(
            rate_model=None,  # Injected
            market_data=None,  # Injected
            metrics=None,  # Injected
        )
        
        recommendation = await service.get_optimal_rate(
            job_context={
                "id": request.job_id,
                "title": request.job_title,
                "description": request.job_description,
                "skills_required": request.skills_required,
                "budget_min": request.budget_min,
                "budget_max": request.budget_max,
                "duration": request.duration,
            },
            freelancer_profile=request.freelancer_profile,
            strategy=request.strategy,
        )
        
        # Track optimization for model improvement
        background_tasks.add_task(
            _track_rate_optimization,
            request.job_id,
            request.freelancer_profile.get("user_id"),
            recommendation,
        )
        
        return OptimizeRateResponse(
            recommended_rate=recommendation.recommended_rate,
            rate_range={
                "min": recommendation.rate_range[0],
                "max": recommendation.rate_range[1],
            },
            win_probability=recommendation.win_probability,
            expected_value=recommendation.expected_value,
            confidence=recommendation.confidence,
            reasoning=recommendation.reasoning,
            alternative_strategies=recommendation.alternative_strategies,
            market_position={
                "percentile": recommendation.market_percentile,
                "position": recommendation.market_position,
            },
        )
        
    except Exception as e:
        logger.error(
            "Rate optimization failed",
            job_id=request.job_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to optimize rate: {str(e)}"
        )


@router.post("/analyze", response_model=AnalyzeRateResponse)
async def analyze_rate(
    request: AnalyzeRateRequest,
    background_tasks: BackgroundTasks,
) -> AnalyzeRateResponse:
    """
    Analyze a proposed rate and return win probability.
    
    Shows how the proposed rate compares to:
    - Market rates for similar skills
    - Historical winning bids
    - Expected value calculations
    """
    logger.info(
        "Analyzing proposed rate",
        job_id=request.job_id,
        proposed_rate=request.proposed_rate,
    )
    
    try:
        service = RateOptimizerService(
            rate_model=None,
            market_data=None,
            metrics=None,
        )
        
        analysis = await service.analyze_proposed_rate(
            job_id=request.job_id,
            proposed_rate=request.proposed_rate,
            job_skills=request.job_skills,
            freelancer_profile=request.freelancer_profile,
        )
        
        return AnalyzeRateResponse(
            proposed_rate=request.proposed_rate,
            win_probability=analysis.win_probability,
            market_position=analysis.market_position,
            market_percentile=analysis.market_percentile,
            competitive_analysis=analysis.competitive_analysis,
            recommendations=analysis.recommendations,
            expected_value=request.proposed_rate * analysis.win_probability,
        )
        
    except Exception as e:
        logger.error(
            "Rate analysis failed",
            job_id=request.job_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze rate: {str(e)}"
        )


@router.get("/market/{skill}", response_model=MarketRateResponse)
async def get_market_rate(
    skill: str,
    experience_level: Optional[str] = None,
    location: Optional[str] = None,
) -> MarketRateResponse:
    """
    Get market rate data for a skill.
    
    Returns rate percentiles based on:
    - Historical bid data
    - Experience level adjustments
    - Geographic factors
    """
    logger.info(
        "Fetching market rate",
        skill=skill,
        experience_level=experience_level,
    )
    
    try:
        service = RateOptimizerService(
            rate_model=None,
            market_data=None,
            metrics=None,
        )
        
        market_data = await service.get_market_rate(
            skill=skill,
            experience_level=experience_level or "mid",
            location=location,
        )
        
        return MarketRateResponse(
            skill=skill,
            experience_level=market_data.experience_level,
            percentile_25=market_data.percentile_25,
            percentile_50=market_data.percentile_50,
            percentile_75=market_data.percentile_75,
            percentile_90=market_data.percentile_90,
            sample_size=market_data.sample_size,
            trend=market_data.trend,
            last_updated=market_data.last_updated.isoformat(),
        )
        
    except Exception as e:
        logger.error(
            "Market rate fetch failed",
            skill=skill,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get market rate: {str(e)}"
        )


@router.post("/feedback")
async def record_rate_feedback(
    request: RateFeedbackRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Record rate outcome for model learning.
    
    This data is crucial for:
    - Improving win probability predictions
    - Calibrating rate recommendations
    - Understanding market dynamics
    """
    logger.info(
        "Recording rate outcome",
        job_id=request.job_id,
        outcome=request.outcome,
    )
    
    # Queue outcome processing for model training
    background_tasks.add_task(
        _process_rate_outcome,
        request.job_id,
        request.freelancer_id,
        request.proposed_rate,
        request.outcome,
        request.client_feedback,
    )
    
    return {
        "status": "recorded",
        "job_id": request.job_id,
    }


# =============================================================================
# BACKGROUND TASKS
# =============================================================================

async def _track_rate_optimization(
    job_id: str,
    freelancer_id: str,
    recommendation: dict,
):
    """Track rate optimization for model improvement."""
    # Store recommendation for later outcome matching
    pass


async def _process_rate_outcome(
    job_id: str,
    freelancer_id: str,
    proposed_rate: float,
    outcome: str,
    client_feedback: Optional[str],
):
    """Process rate outcome for model training."""
    # Add to training dataset
    # Check if retraining threshold met
    pass
