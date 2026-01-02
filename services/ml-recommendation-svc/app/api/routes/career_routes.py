"""
Career Coach Routes
API endpoints for AI-powered career guidance
Sprint M7: AI Work Assistant
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from datetime import datetime
import structlog

from app.api.career_coach import CareerCoachService
from app.api.earnings_predictor import EarningsPredictor

router = APIRouter(prefix="/ai/career", tags=["Career Coach"])
logger = structlog.get_logger()


# =============================================================================
# REQUEST/RESPONSE SCHEMAS
# =============================================================================

class CareerAnalysisResponse(BaseModel):
    """Full career analysis"""
    user_id: str
    current_state: dict
    trajectory: dict
    market_position: dict
    growth_opportunities: List[dict]
    peer_comparison: dict
    generated_at: str


class CareerRecommendationsResponse(BaseModel):
    """Personalized career recommendations"""
    user_id: str
    recommendations: List[dict]
    priority_actions: List[str]
    quick_wins: List[str]
    long_term_strategies: List[str]


class SetGoalRequest(BaseModel):
    """Request to set a career goal"""
    user_id: str
    category: str = Field(
        ...,
        description="earnings, skills, clients, rates, reputation, specialization"
    )
    timeframe: str = Field(
        ...,
        description="short_term (3 months), medium_term (1 year), long_term (3 years)"
    )
    target_value: float
    description: str
    milestones: Optional[List[dict]] = None


class GoalResponse(BaseModel):
    """Career goal details"""
    id: str
    user_id: str
    category: str
    timeframe: str
    target_value: float
    current_value: float
    description: str
    milestones: List[dict]
    progress_percentage: float
    status: str
    created_at: str
    deadline: str
    feasibility_score: float
    recommendations: List[str]


class GoalProgressResponse(BaseModel):
    """Progress towards career goals"""
    user_id: str
    goals: List[dict]
    overall_progress: float
    achievements: List[dict]
    next_milestones: List[dict]


class EarningsPredictionRequest(BaseModel):
    """Request for earnings prediction"""
    user_id: str
    horizon_months: int = Field(
        default=12,
        description="Prediction horizon in months"
    )
    include_scenarios: bool = True


class EarningsPredictionResponse(BaseModel):
    """Earnings prediction results"""
    user_id: str
    current_monthly: float
    predicted_monthly: dict
    growth_rate: float
    confidence_interval: dict
    scenarios: Optional[List[dict]] = None
    key_factors: List[str]


class ScenarioRequest(BaseModel):
    """Request to model a what-if scenario"""
    user_id: str
    scenario_type: str = Field(
        ...,
        description="skill_learn, rate_increase, market_shift, certification"
    )
    parameters: dict


class ScenarioResponse(BaseModel):
    """Scenario modeling results"""
    scenario_type: str
    current_projection: dict
    scenario_projection: dict
    impact: dict
    feasibility: float
    time_to_impact: str
    action_steps: List[str]


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/analysis", response_model=CareerAnalysisResponse)
async def get_career_analysis(
    user_id: str,
) -> CareerAnalysisResponse:
    """
    Get comprehensive career analysis.
    
    Analyzes:
    - Current earnings and rate position
    - Growth trajectory and trends
    - Market positioning vs peers
    - Growth opportunities
    """
    logger.info(
        "Generating career analysis",
        user_id=user_id,
    )
    
    try:
        service = CareerCoachService(
            career_model=None,  # Injected
            market_data=None,  # Injected
            metrics=None,  # Injected
        )
        
        analysis = await service.get_career_analysis(user_id)
        
        return CareerAnalysisResponse(
            user_id=user_id,
            current_state={
                "monthly_earnings": analysis.current_state.current_monthly_earnings,
                "hourly_rate": analysis.current_state.average_hourly_rate,
                "active_clients": analysis.current_state.active_clients,
                "total_projects": analysis.current_state.total_projects,
                "completion_rate": analysis.current_state.completion_rate,
                "rating": analysis.current_state.rating,
                "top_skills": analysis.current_state.top_skills,
                "experience_years": analysis.current_state.experience_years,
            },
            trajectory={
                "trend": analysis.trajectory.trend,
                "growth_rate": analysis.trajectory.growth_rate,
                "projection_6_months": analysis.trajectory.projection_6_months,
                "projection_12_months": analysis.trajectory.projection_12_months,
            },
            market_position={
                "rate_percentile": analysis.market_position.rate_percentile,
                "earnings_percentile": analysis.market_position.earnings_percentile,
                "skill_demand_score": analysis.market_position.skill_demand_score,
                "competition_level": analysis.market_position.competition_level,
            },
            growth_opportunities=[
                {
                    "type": opp.opportunity_type,
                    "title": opp.title,
                    "description": opp.description,
                    "potential_impact": opp.potential_impact,
                    "effort_required": opp.effort_required,
                }
                for opp in analysis.growth_opportunities
            ],
            peer_comparison={
                "earnings_vs_peers": analysis.peer_comparison.earnings_vs_peers,
                "rate_vs_peers": analysis.peer_comparison.rate_vs_peers,
                "growth_vs_peers": analysis.peer_comparison.growth_vs_peers,
            },
            generated_at=datetime.utcnow().isoformat(),
        )
        
    except Exception as e:
        logger.error(
            "Career analysis failed",
            user_id=user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate career analysis: {str(e)}"
        )


@router.get("/recommendations", response_model=CareerRecommendationsResponse)
async def get_career_recommendations(
    user_id: str,
    limit: int = 5,
) -> CareerRecommendationsResponse:
    """
    Get personalized career recommendations.
    
    Provides actionable suggestions:
    - Skills to learn for earnings boost
    - Rate adjustment opportunities
    - Market segments to target
    - Portfolio improvements
    """
    logger.info(
        "Generating career recommendations",
        user_id=user_id,
    )
    
    try:
        service = CareerCoachService(
            career_model=None,
            market_data=None,
            metrics=None,
        )
        
        recommendations = await service.get_recommendations(
            user_id=user_id,
            limit=limit,
        )
        
        return CareerRecommendationsResponse(
            user_id=user_id,
            recommendations=[
                {
                    "type": rec.recommendation_type,
                    "title": rec.title,
                    "description": rec.description,
                    "potential_impact": rec.potential_impact,
                    "action_items": rec.action_items,
                    "timeframe": rec.timeframe,
                    "confidence": rec.confidence,
                }
                for rec in recommendations.items
            ],
            priority_actions=recommendations.priority_actions,
            quick_wins=recommendations.quick_wins,
            long_term_strategies=recommendations.long_term_strategies,
        )
        
    except Exception as e:
        logger.error(
            "Career recommendations failed",
            user_id=user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate recommendations: {str(e)}"
        )


@router.post("/goals", response_model=GoalResponse)
async def set_career_goal(
    request: SetGoalRequest,
    background_tasks: BackgroundTasks,
) -> GoalResponse:
    """
    Set a new career goal.
    
    Goals can be for:
    - Earnings targets
    - Skill acquisition
    - Client base growth
    - Rate increases
    - Reputation building
    """
    logger.info(
        "Setting career goal",
        user_id=request.user_id,
        category=request.category,
        timeframe=request.timeframe,
    )
    
    try:
        service = CareerCoachService(
            career_model=None,
            market_data=None,
            metrics=None,
        )
        
        goal = await service.set_goal(
            user_id=request.user_id,
            category=request.category,
            timeframe=request.timeframe,
            target_value=request.target_value,
            description=request.description,
            milestones=request.milestones,
        )
        
        # Calculate feasibility
        feasibility = await service.assess_goal_feasibility(goal)
        
        # Schedule progress tracking
        background_tasks.add_task(
            _setup_goal_tracking,
            goal.id,
            request.user_id,
        )
        
        return GoalResponse(
            id=goal.id,
            user_id=goal.user_id,
            category=goal.category,
            timeframe=goal.timeframe,
            target_value=goal.target_value,
            current_value=goal.current_value,
            description=goal.description,
            milestones=goal.milestones,
            progress_percentage=(goal.current_value / goal.target_value) * 100,
            status=goal.status,
            created_at=goal.created_at.isoformat(),
            deadline=goal.deadline.isoformat(),
            feasibility_score=feasibility.score,
            recommendations=feasibility.recommendations,
        )
        
    except Exception as e:
        logger.error(
            "Goal setting failed",
            user_id=request.user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to set goal: {str(e)}"
        )


@router.get("/progress", response_model=GoalProgressResponse)
async def get_goal_progress(
    user_id: str,
) -> GoalProgressResponse:
    """
    Get progress towards career goals.
    
    Shows:
    - Current progress on each goal
    - Recent achievements
    - Upcoming milestones
    """
    logger.info(
        "Fetching goal progress",
        user_id=user_id,
    )
    
    try:
        service = CareerCoachService(
            career_model=None,
            market_data=None,
            metrics=None,
        )
        
        progress = await service.get_goal_progress(user_id)
        
        return GoalProgressResponse(
            user_id=user_id,
            goals=[
                {
                    "id": goal.id,
                    "category": goal.category,
                    "description": goal.description,
                    "progress": goal.progress_percentage,
                    "status": goal.status,
                    "deadline": goal.deadline.isoformat(),
                }
                for goal in progress.goals
            ],
            overall_progress=progress.overall_progress,
            achievements=[
                {
                    "title": a.title,
                    "date": a.date.isoformat(),
                    "description": a.description,
                }
                for a in progress.achievements
            ],
            next_milestones=[
                {
                    "goal_id": m.goal_id,
                    "title": m.title,
                    "due_date": m.due_date.isoformat(),
                    "status": m.status,
                }
                for m in progress.next_milestones
            ],
        )
        
    except Exception as e:
        logger.error(
            "Goal progress fetch failed",
            user_id=user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get goal progress: {str(e)}"
        )


@router.get("/earnings-prediction", response_model=EarningsPredictionResponse)
async def get_earnings_prediction(
    user_id: str,
    horizon_months: int = 12,
    include_scenarios: bool = True,
) -> EarningsPredictionResponse:
    """
    Get earnings prediction based on current trajectory.
    
    Uses:
    - Historical earnings data
    - Skill improvements
    - Market trends
    - Seasonal patterns
    """
    logger.info(
        "Generating earnings prediction",
        user_id=user_id,
        horizon_months=horizon_months,
    )
    
    try:
        predictor = EarningsPredictor(
            model=None,  # Injected
            market_data=None,  # Injected
        )
        
        prediction = await predictor.predict(
            user_id=user_id,
            horizon_months=horizon_months,
            include_scenarios=include_scenarios,
        )
        
        return EarningsPredictionResponse(
            user_id=user_id,
            current_monthly=prediction.current_monthly,
            predicted_monthly={
                f"month_{i}": val
                for i, val in enumerate(prediction.monthly_predictions)
            },
            growth_rate=prediction.growth_rate,
            confidence_interval={
                "lower": prediction.confidence_lower,
                "upper": prediction.confidence_upper,
            },
            scenarios=[
                {
                    "name": s.name,
                    "description": s.description,
                    "predicted_monthly": s.predicted_monthly,
                    "impact_percentage": s.impact_percentage,
                }
                for s in prediction.scenarios
            ] if include_scenarios else None,
            key_factors=prediction.key_factors,
        )
        
    except Exception as e:
        logger.error(
            "Earnings prediction failed",
            user_id=user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to predict earnings: {str(e)}"
        )


@router.post("/scenario", response_model=ScenarioResponse)
async def model_scenario(
    request: ScenarioRequest,
) -> ScenarioResponse:
    """
    Model a what-if scenario.
    
    Scenarios:
    - "If I learn X skill..."
    - "If I raise my rate to Y..."
    - "If I target Z market..."
    - "If I get A certification..."
    """
    logger.info(
        "Modeling scenario",
        user_id=request.user_id,
        scenario_type=request.scenario_type,
    )
    
    try:
        predictor = EarningsPredictor(
            model=None,
            market_data=None,
        )
        
        scenario = await predictor.model_scenario(
            user_id=request.user_id,
            scenario_type=request.scenario_type,
            parameters=request.parameters,
        )
        
        return ScenarioResponse(
            scenario_type=request.scenario_type,
            current_projection={
                "monthly_earnings": scenario.current_projection.monthly,
                "annual_earnings": scenario.current_projection.annual,
            },
            scenario_projection={
                "monthly_earnings": scenario.scenario_projection.monthly,
                "annual_earnings": scenario.scenario_projection.annual,
            },
            impact={
                "monthly_increase": scenario.impact.monthly_increase,
                "percentage_increase": scenario.impact.percentage_increase,
                "annual_increase": scenario.impact.annual_increase,
            },
            feasibility=scenario.feasibility,
            time_to_impact=scenario.time_to_impact,
            action_steps=scenario.action_steps,
        )
        
    except Exception as e:
        logger.error(
            "Scenario modeling failed",
            user_id=request.user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to model scenario: {str(e)}"
        )


# =============================================================================
# BACKGROUND TASKS
# =============================================================================

async def _setup_goal_tracking(goal_id: str, user_id: str):
    """Setup tracking for a new goal."""
    # Schedule periodic progress checks
    # Setup milestone notifications
    pass
