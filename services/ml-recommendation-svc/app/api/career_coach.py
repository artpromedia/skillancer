"""
Career Coach AI
Personalized career guidance for freelancers
Sprint M7: AI Work Assistant
"""

from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

class GoalTimeframe(str, Enum):
    SHORT_TERM = "short_term"  # 3 months
    MEDIUM_TERM = "medium_term"  # 1 year
    LONG_TERM = "long_term"  # 3 years


class GoalCategory(str, Enum):
    EARNINGS = "earnings"
    SKILLS = "skills"
    CLIENTS = "clients"
    RATES = "rates"
    REPUTATION = "reputation"
    SPECIALIZATION = "specialization"


class RecommendationType(str, Enum):
    SKILL_UP = "skill_up"
    RATE_INCREASE = "rate_increase"
    MARKET_SHIFT = "market_shift"
    CLIENT_TARGETING = "client_targeting"
    PORTFOLIO = "portfolio"
    CERTIFICATION = "certification"


class CareerGoal(BaseModel):
    """A career goal"""
    id: str
    user_id: str
    category: GoalCategory
    timeframe: GoalTimeframe
    target_value: float
    current_value: float
    description: str
    created_at: datetime
    deadline: datetime
    milestones: list[dict]
    status: str  # active, completed, abandoned


class CareerAnalysis(BaseModel):
    """Full career analysis"""
    user_id: str
    current_state: CareerSnapshot
    trajectory: EarningsTrajectory
    market_position: MarketPosition
    growth_opportunities: list[GrowthOpportunity]
    peer_comparison: PeerComparison


class CareerSnapshot(BaseModel):
    """Current career state"""
    current_monthly_earnings: float
    average_hourly_rate: float
    active_clients: int
    total_projects: int
    completion_rate: float
    rating: float
    top_skills: list[str]
    experience_years: int
    specialization: Optional[str]


class EarningsTrajectory(BaseModel):
    """Earnings trend analysis"""
    trend: str  # growing, stable, declining
    growth_rate: float  # percentage
    projection_6_months: float
    projection_12_months: float
    seasonality_factor: float


class MarketPosition(BaseModel):
    """Position in the market"""
    rate_percentile: int  # 0-100
    earnings_percentile: int
    skill_demand_score: float
    competition_level: str
    market_saturation: float


class GrowthOpportunity(BaseModel):
    """Identified growth opportunity"""
    type: RecommendationType
    title: str
    description: str
    potential_impact: float  # percentage earnings increase
    effort_level: str  # low, medium, high
    time_to_impact: int  # days
    action_items: list[str]


class PeerComparison(BaseModel):
    """Anonymous comparison to peers"""
    similar_freelancers_count: int
    earnings_vs_peers: str  # above, average, below
    rate_vs_peers: str
    growth_vs_peers: str
    distinguishing_factors: list[str]


class Recommendation(BaseModel):
    """Personalized recommendation"""
    id: str
    type: RecommendationType
    priority: int  # 1-5
    title: str
    description: str
    reasoning: str
    potential_earnings_increase: float
    action_items: list[str]
    resources: list[dict]
    estimated_time: str


# =============================================================================
# CAREER COACH SERVICE
# =============================================================================

class CareerCoachService:
    """
    AI-powered career coaching for freelancers
    
    Provides personalized analysis and recommendations
    based on freelancer data and market trends.
    """
    
    def __init__(self, llm_client, market_data, metrics):
        self.llm = llm_client
        self.market = market_data
        self.metrics = metrics
    
    # -------------------------------------------------------------------------
    # CAREER ANALYSIS
    # -------------------------------------------------------------------------
    
    async def get_career_analysis(self, user_id: str) -> CareerAnalysis:
        """
        Get comprehensive career analysis
        """
        logger.info(f"Getting career analysis for {user_id}")
        
        # Get current state
        current_state = await self._get_current_state(user_id)
        
        # Calculate trajectory
        trajectory = await self._calculate_trajectory(user_id)
        
        # Determine market position
        market_position = await self._get_market_position(user_id, current_state)
        
        # Identify growth opportunities
        opportunities = await self._identify_opportunities(
            current_state, market_position
        )
        
        # Compare to peers
        peer_comparison = await self._compare_to_peers(user_id, current_state)
        
        self.metrics.increment('career_coach.analysis_generated')
        
        return CareerAnalysis(
            user_id=user_id,
            current_state=current_state,
            trajectory=trajectory,
            market_position=market_position,
            growth_opportunities=opportunities,
            peer_comparison=peer_comparison
        )
    
    async def _get_current_state(self, user_id: str) -> CareerSnapshot:
        """Get current career state"""
        # In production: Query database
        return CareerSnapshot(
            current_monthly_earnings=5000,
            average_hourly_rate=75,
            active_clients=3,
            total_projects=45,
            completion_rate=0.96,
            rating=4.8,
            top_skills=["python", "django", "react"],
            experience_years=5,
            specialization="Web Development"
        )
    
    async def _calculate_trajectory(self, user_id: str) -> EarningsTrajectory:
        """Calculate earnings trajectory"""
        # In production: Analyze historical earnings data
        return EarningsTrajectory(
            trend="growing",
            growth_rate=12.5,
            projection_6_months=5500,
            projection_12_months=6200,
            seasonality_factor=0.95
        )
    
    async def _get_market_position(
        self,
        user_id: str,
        state: CareerSnapshot
    ) -> MarketPosition:
        """Determine market position"""
        # Get market data for skills
        market_rates = await self.market.get_rates_for_skills(state.top_skills)
        
        # Calculate percentiles
        if market_rates:
            median_rate = market_rates.get('median', 60)
            rate_percentile = min(100, int((state.average_hourly_rate / median_rate) * 50))
        else:
            rate_percentile = 50
        
        return MarketPosition(
            rate_percentile=rate_percentile,
            earnings_percentile=65,
            skill_demand_score=0.78,
            competition_level="medium",
            market_saturation=0.65
        )
    
    async def _identify_opportunities(
        self,
        state: CareerSnapshot,
        position: MarketPosition
    ) -> list[GrowthOpportunity]:
        """Identify growth opportunities"""
        opportunities = []
        
        # Rate increase opportunity
        if position.rate_percentile < 70:
            opportunities.append(GrowthOpportunity(
                type=RecommendationType.RATE_INCREASE,
                title="Rate Increase Opportunity",
                description=f"Your rate is in the {position.rate_percentile}th percentile. Consider increasing.",
                potential_impact=15,
                effort_level="low",
                time_to_impact=30,
                action_items=[
                    "Update your rate on your profile",
                    "Start quoting higher on new proposals",
                    "Communicate value more clearly"
                ]
            ))
        
        # Skill-based opportunities
        trending_skills = await self.market.get_trending_skills(state.top_skills)
        for skill in trending_skills[:2]:
            opportunities.append(GrowthOpportunity(
                type=RecommendationType.SKILL_UP,
                title=f"Learn {skill['name']}",
                description=f"{skill['name']} is in high demand and complements your skills",
                potential_impact=skill.get('potential_increase', 20),
                effort_level="medium",
                time_to_impact=90,
                action_items=[
                    f"Take a course on {skill['name']}",
                    "Build a portfolio project",
                    "Update your profile with new skill"
                ]
            ))
        
        # Client targeting
        if state.active_clients < 5:
            opportunities.append(GrowthOpportunity(
                type=RecommendationType.CLIENT_TARGETING,
                title="Expand Client Base",
                description="Diversify income with more active clients",
                potential_impact=25,
                effort_level="medium",
                time_to_impact=60,
                action_items=[
                    "Send 10 proposals per week",
                    "Reach out to past clients",
                    "Optimize your profile for search"
                ]
            ))
        
        return opportunities
    
    async def _compare_to_peers(
        self,
        user_id: str,
        state: CareerSnapshot
    ) -> PeerComparison:
        """Compare to similar freelancers (anonymized)"""
        # In production: Query aggregated peer data
        return PeerComparison(
            similar_freelancers_count=1250,
            earnings_vs_peers="above",
            rate_vs_peers="average",
            growth_vs_peers="above",
            distinguishing_factors=[
                "High completion rate",
                "Strong client reviews",
                "Diverse skill set"
            ]
        )
    
    # -------------------------------------------------------------------------
    # RECOMMENDATIONS
    # -------------------------------------------------------------------------
    
    async def get_recommendations(
        self,
        user_id: str,
        limit: int = 5
    ) -> list[Recommendation]:
        """
        Get personalized recommendations
        """
        logger.info(f"Getting recommendations for {user_id}")
        
        # Get analysis
        analysis = await self.get_career_analysis(user_id)
        
        # Generate recommendations from opportunities
        recommendations = []
        
        for i, opp in enumerate(analysis.growth_opportunities[:limit]):
            rec = await self._opportunity_to_recommendation(opp, i + 1)
            recommendations.append(rec)
        
        # Add AI-generated insights
        ai_recommendations = await self._generate_ai_recommendations(analysis)
        recommendations.extend(ai_recommendations[:limit - len(recommendations)])
        
        self.metrics.increment('career_coach.recommendations_generated')
        
        return recommendations[:limit]
    
    async def _opportunity_to_recommendation(
        self,
        opp: GrowthOpportunity,
        priority: int
    ) -> Recommendation:
        """Convert opportunity to recommendation"""
        return Recommendation(
            id=f"rec-{opp.type.value}-{priority}",
            type=opp.type,
            priority=priority,
            title=opp.title,
            description=opp.description,
            reasoning=f"Based on your current position, this could increase earnings by {opp.potential_impact}%",
            potential_earnings_increase=opp.potential_impact,
            action_items=opp.action_items,
            resources=[],
            estimated_time=f"{opp.time_to_impact} days"
        )
    
    async def _generate_ai_recommendations(
        self,
        analysis: CareerAnalysis
    ) -> list[Recommendation]:
        """Generate AI-powered recommendations"""
        prompt = f"""
Based on this freelancer's career profile, provide personalized recommendations:

Current State:
- Monthly earnings: ${analysis.current_state.current_monthly_earnings}
- Hourly rate: ${analysis.current_state.average_hourly_rate}
- Skills: {', '.join(analysis.current_state.top_skills)}
- Rating: {analysis.current_state.rating}
- Experience: {analysis.current_state.experience_years} years

Market Position:
- Rate percentile: {analysis.market_position.rate_percentile}
- Competition: {analysis.market_position.competition_level}

Trajectory:
- Trend: {analysis.trajectory.trend}
- Growth rate: {analysis.trajectory.growth_rate}%

Provide 2-3 specific, actionable recommendations to grow earnings.
"""
        
        response = await self.llm.generate(
            prompt=prompt,
            system_prompt="""You are a career coach for freelancers.
Provide specific, actionable advice based on data.
Focus on practical steps that can be implemented quickly.""",
            temperature=0.6,
            max_tokens=1500
        )
        
        # Parse response into recommendations
        return self._parse_ai_recommendations(response)
    
    def _parse_ai_recommendations(self, response: str) -> list[Recommendation]:
        """Parse AI recommendations"""
        # In production: Parse structured output
        return []
    
    # -------------------------------------------------------------------------
    # GOALS
    # -------------------------------------------------------------------------
    
    async def set_goal(
        self,
        user_id: str,
        category: GoalCategory,
        timeframe: GoalTimeframe,
        target_value: float,
        description: str
    ) -> CareerGoal:
        """Set a career goal"""
        logger.info(f"Setting goal for {user_id}: {category}")
        
        # Get current value
        current_value = await self._get_current_value(user_id, category)
        
        # Calculate deadline
        deadline = self._calculate_deadline(timeframe)
        
        # Generate milestones
        milestones = self._generate_milestones(
            current_value, target_value, deadline
        )
        
        goal = CareerGoal(
            id=f"goal-{user_id}-{datetime.utcnow().timestamp()}",
            user_id=user_id,
            category=category,
            timeframe=timeframe,
            target_value=target_value,
            current_value=current_value,
            description=description,
            created_at=datetime.utcnow(),
            deadline=deadline,
            milestones=milestones,
            status="active"
        )
        
        # In production: Save to database
        
        self.metrics.increment('career_coach.goal_set', tags={'category': category.value})
        
        return goal
    
    async def get_goal_progress(self, user_id: str) -> list[dict]:
        """Get progress on all goals"""
        # In production: Query goals from database
        goals = await self._get_user_goals(user_id)
        
        progress = []
        for goal in goals:
            current = await self._get_current_value(user_id, goal.category)
            progress_pct = (current - goal.current_value) / (goal.target_value - goal.current_value) * 100
            
            progress.append({
                "goal": goal,
                "current_value": current,
                "progress_percentage": min(100, max(0, progress_pct)),
                "on_track": self._is_on_track(goal, current),
                "days_remaining": (goal.deadline - datetime.utcnow()).days
            })
        
        return progress
    
    async def _get_current_value(self, user_id: str, category: GoalCategory) -> float:
        """Get current value for a goal category"""
        # In production: Query based on category
        values = {
            GoalCategory.EARNINGS: 5000,
            GoalCategory.RATES: 75,
            GoalCategory.CLIENTS: 3,
            GoalCategory.REPUTATION: 4.8,
            GoalCategory.SKILLS: 5,
            GoalCategory.SPECIALIZATION: 0.7
        }
        return values.get(category, 0)
    
    def _calculate_deadline(self, timeframe: GoalTimeframe) -> datetime:
        """Calculate goal deadline"""
        days = {
            GoalTimeframe.SHORT_TERM: 90,
            GoalTimeframe.MEDIUM_TERM: 365,
            GoalTimeframe.LONG_TERM: 365 * 3
        }
        return datetime.utcnow() + timedelta(days=days[timeframe])
    
    def _generate_milestones(
        self,
        current: float,
        target: float,
        deadline: datetime
    ) -> list[dict]:
        """Generate milestones for goal"""
        milestones = []
        total_days = (deadline - datetime.utcnow()).days
        increment = (target - current) / 4
        
        for i in range(1, 4):
            milestone_date = datetime.utcnow() + timedelta(days=(total_days * i) // 4)
            milestone_value = current + (increment * i)
            milestones.append({
                "index": i,
                "target_value": milestone_value,
                "deadline": milestone_date.isoformat(),
                "completed": False
            })
        
        return milestones
    
    def _is_on_track(self, goal: CareerGoal, current: float) -> bool:
        """Check if on track for goal"""
        total_time = (goal.deadline - goal.created_at).days
        elapsed_time = (datetime.utcnow() - goal.created_at).days
        expected_progress = (goal.target_value - goal.current_value) * (elapsed_time / total_time)
        actual_progress = current - goal.current_value
        return actual_progress >= expected_progress * 0.9
    
    async def _get_user_goals(self, user_id: str) -> list[CareerGoal]:
        """Get user's goals"""
        # In production: Query database
        return []


# =============================================================================
# FACTORY
# =============================================================================

_service: Optional[CareerCoachService] = None

def get_career_coach_service() -> CareerCoachService:
    """Get CareerCoachService singleton"""
    global _service
    if _service is None:
        from app.llm.openai_client import get_openai_client
        from app.data.market_data import get_market_data
        from app.metrics import get_metrics
        
        _service = CareerCoachService(
            llm_client=get_openai_client(),
            market_data=get_market_data(),
            metrics=get_metrics()
        )
    return _service
