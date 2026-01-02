"""
Earnings Predictor
Predict future earnings and model scenarios
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

class ScenarioType(str, Enum):
    SKILL_ADDITION = "skill_addition"
    RATE_CHANGE = "rate_change"
    HOURS_CHANGE = "hours_change"
    MARKET_SHIFT = "market_shift"
    SPECIALIZATION = "specialization"
    CERTIFICATION = "certification"


class EarningsPrediction(BaseModel):
    """Earnings prediction"""
    user_id: str
    current_monthly: float
    predicted_3_months: float
    predicted_6_months: float
    predicted_12_months: float
    confidence: float
    factors: list[dict]
    assumptions: list[str]


class SeasonalPattern(BaseModel):
    """Seasonal earnings pattern"""
    month: int
    adjustment_factor: float
    typical_variation: str


class ScenarioInput(BaseModel):
    """Input for scenario modeling"""
    scenario_type: ScenarioType
    parameters: dict


class ScenarioResult(BaseModel):
    """Scenario modeling result"""
    scenario_type: ScenarioType
    baseline_earnings: float
    projected_earnings: float
    earnings_change: float
    percentage_change: float
    time_to_impact: int  # days
    probability: float
    key_assumptions: list[str]
    action_items: list[str]


class GoalFeasibility(BaseModel):
    """Feasibility analysis for an earnings goal"""
    target_earnings: float
    target_date: datetime
    is_feasible: bool
    feasibility_score: float  # 0-1
    current_trajectory_outcome: float
    gap_to_goal: float
    required_actions: list[dict]
    risk_factors: list[str]
    alternative_targets: list[dict]


# =============================================================================
# EARNINGS PREDICTOR
# =============================================================================

class EarningsPredictor:
    """
    Predict future earnings based on:
    - Current trajectory
    - Skill improvements
    - Market trends
    - Seasonal patterns
    """
    
    def __init__(self, market_data, metrics):
        self.market = market_data
        self.metrics = metrics
    
    # -------------------------------------------------------------------------
    # PREDICTIONS
    # -------------------------------------------------------------------------
    
    async def predict_earnings(
        self,
        user_id: str,
        months_ahead: int = 12
    ) -> EarningsPrediction:
        """
        Predict future earnings
        """
        logger.info(f"Predicting earnings for {user_id}")
        
        # Get historical data
        history = await self._get_earnings_history(user_id)
        
        # Calculate current baseline
        current_monthly = self._calculate_current_baseline(history)
        
        # Calculate growth trend
        growth_rate = self._calculate_growth_rate(history)
        
        # Get market trends
        market_factor = await self._get_market_factor(user_id)
        
        # Apply seasonal adjustments
        seasonal_factors = self._get_seasonal_factors()
        
        # Calculate predictions
        predictions = self._project_earnings(
            current_monthly,
            growth_rate,
            market_factor,
            seasonal_factors,
            months_ahead
        )
        
        self.metrics.increment('earnings_predictor.prediction_generated')
        
        return EarningsPrediction(
            user_id=user_id,
            current_monthly=current_monthly,
            predicted_3_months=predictions[2],
            predicted_6_months=predictions[5],
            predicted_12_months=predictions[11] if months_ahead >= 12 else predictions[-1],
            confidence=self._calculate_confidence(history),
            factors=[
                {"factor": "growth_trend", "impact": growth_rate * 100},
                {"factor": "market_conditions", "impact": (market_factor - 1) * 100},
                {"factor": "seasonality", "impact": "varies by month"}
            ],
            assumptions=[
                "Consistent work hours",
                "No major market disruptions",
                "Continued client relationships"
            ]
        )
    
    def _calculate_current_baseline(self, history: list[dict]) -> float:
        """Calculate current monthly baseline"""
        if not history:
            return 0
        
        # Use 3-month rolling average
        recent = history[-3:] if len(history) >= 3 else history
        return sum(h['earnings'] for h in recent) / len(recent)
    
    def _calculate_growth_rate(self, history: list[dict]) -> float:
        """Calculate monthly growth rate"""
        if len(history) < 3:
            return 0.02  # Default 2% growth
        
        # Calculate average monthly growth
        growth_rates = []
        for i in range(1, len(history)):
            prev = history[i-1]['earnings']
            curr = history[i]['earnings']
            if prev > 0:
                growth_rates.append((curr - prev) / prev)
        
        if not growth_rates:
            return 0.02
        
        return sum(growth_rates) / len(growth_rates)
    
    async def _get_market_factor(self, user_id: str) -> float:
        """Get market adjustment factor"""
        # In production: Query market trends for user's skills
        return 1.05  # 5% market growth
    
    def _get_seasonal_factors(self) -> dict[int, float]:
        """Get seasonal adjustment factors by month"""
        # Freelance work tends to dip in summer and holidays
        return {
            1: 0.95,   # January - slow start
            2: 1.00,
            3: 1.05,
            4: 1.05,
            5: 1.00,
            6: 0.95,   # Summer slowdown
            7: 0.90,
            8: 0.90,
            9: 1.05,   # Back to business
            10: 1.10,
            11: 1.05,
            12: 0.85   # Holiday slowdown
        }
    
    def _project_earnings(
        self,
        baseline: float,
        growth_rate: float,
        market_factor: float,
        seasonal_factors: dict[int, float],
        months: int
    ) -> list[float]:
        """Project earnings for future months"""
        projections = []
        current = baseline
        current_month = datetime.utcnow().month
        
        for i in range(months):
            month = ((current_month + i - 1) % 12) + 1
            seasonal = seasonal_factors.get(month, 1.0)
            
            # Apply growth and factors
            projected = current * (1 + growth_rate) * market_factor * seasonal
            projections.append(round(projected, 2))
            
            # Update base for next iteration (without seasonal)
            current = current * (1 + growth_rate) * market_factor
        
        return projections
    
    def _calculate_confidence(self, history: list[dict]) -> float:
        """Calculate prediction confidence"""
        if len(history) < 3:
            return 0.4
        elif len(history) < 6:
            return 0.6
        elif len(history) < 12:
            return 0.75
        else:
            return 0.85
    
    async def _get_earnings_history(self, user_id: str) -> list[dict]:
        """Get historical earnings data"""
        # In production: Query database
        return [
            {"month": "2024-07", "earnings": 4500},
            {"month": "2024-08", "earnings": 4200},
            {"month": "2024-09", "earnings": 5000},
            {"month": "2024-10", "earnings": 5500},
            {"month": "2024-11", "earnings": 5200},
            {"month": "2024-12", "earnings": 4800},
        ]
    
    # -------------------------------------------------------------------------
    # SCENARIO MODELING
    # -------------------------------------------------------------------------
    
    async def model_scenario(
        self,
        user_id: str,
        scenario: ScenarioInput
    ) -> ScenarioResult:
        """
        Model a "what if" scenario
        """
        logger.info(f"Modeling scenario {scenario.scenario_type} for {user_id}")
        
        # Get baseline prediction
        baseline = await self.predict_earnings(user_id)
        
        # Apply scenario-specific adjustments
        if scenario.scenario_type == ScenarioType.SKILL_ADDITION:
            result = await self._model_skill_addition(baseline, scenario.parameters)
        elif scenario.scenario_type == ScenarioType.RATE_CHANGE:
            result = await self._model_rate_change(baseline, scenario.parameters)
        elif scenario.scenario_type == ScenarioType.HOURS_CHANGE:
            result = await self._model_hours_change(baseline, scenario.parameters)
        elif scenario.scenario_type == ScenarioType.CERTIFICATION:
            result = await self._model_certification(baseline, scenario.parameters)
        elif scenario.scenario_type == ScenarioType.SPECIALIZATION:
            result = await self._model_specialization(baseline, scenario.parameters)
        else:
            result = await self._model_generic(baseline, scenario.parameters)
        
        self.metrics.increment('earnings_predictor.scenario_modeled', 
                              tags={'type': scenario.scenario_type.value})
        
        return result
    
    async def _model_skill_addition(
        self,
        baseline: EarningsPrediction,
        params: dict
    ) -> ScenarioResult:
        """Model adding a new skill"""
        skill = params.get('skill', 'Unknown')
        
        # Get market data for skill
        skill_premium = await self.market.get_skill_premium(skill)
        
        projected = baseline.predicted_12_months * (1 + skill_premium)
        
        return ScenarioResult(
            scenario_type=ScenarioType.SKILL_ADDITION,
            baseline_earnings=baseline.predicted_12_months,
            projected_earnings=projected,
            earnings_change=projected - baseline.predicted_12_months,
            percentage_change=skill_premium * 100,
            time_to_impact=90,  # 3 months to learn and apply
            probability=0.7,
            key_assumptions=[
                f"Successfully learn {skill}",
                "Find projects requiring this skill",
                "Market demand remains strong"
            ],
            action_items=[
                f"Enroll in {skill} course",
                "Complete 1-2 practice projects",
                f"Add {skill} to profile",
                "Apply to projects requiring this skill"
            ]
        )
    
    async def _model_rate_change(
        self,
        baseline: EarningsPrediction,
        params: dict
    ) -> ScenarioResult:
        """Model rate increase/decrease"""
        rate_change = params.get('rate_change_percent', 10) / 100
        
        # Higher rates may reduce win rate
        win_rate_impact = self._estimate_win_rate_impact(rate_change)
        
        # Net effect
        net_change = (1 + rate_change) * (1 + win_rate_impact) - 1
        projected = baseline.predicted_12_months * (1 + net_change)
        
        return ScenarioResult(
            scenario_type=ScenarioType.RATE_CHANGE,
            baseline_earnings=baseline.predicted_12_months,
            projected_earnings=projected,
            earnings_change=projected - baseline.predicted_12_months,
            percentage_change=net_change * 100,
            time_to_impact=30,
            probability=0.8,
            key_assumptions=[
                f"Rate change of {rate_change*100:+.0f}%",
                f"Win rate changes by {win_rate_impact*100:+.0f}%",
                "Proposal quality maintained"
            ],
            action_items=[
                "Update profile rate",
                "Adjust proposal language to justify new rate",
                "Focus on higher-budget clients"
            ]
        )
    
    def _estimate_win_rate_impact(self, rate_change: float) -> float:
        """Estimate how rate change affects win rate"""
        # Higher rates = lower win rate (approximately)
        if rate_change > 0.2:
            return -0.15
        elif rate_change > 0.1:
            return -0.08
        elif rate_change > 0:
            return -0.03
        elif rate_change > -0.1:
            return 0.05
        else:
            return 0.10
    
    async def _model_hours_change(
        self,
        baseline: EarningsPrediction,
        params: dict
    ) -> ScenarioResult:
        """Model working hours change"""
        hours_change = params.get('hours_change_percent', 0) / 100
        
        # More hours doesn't scale linearly (burnout, efficiency)
        efficiency_factor = 1 - abs(hours_change) * 0.1
        net_change = hours_change * efficiency_factor
        projected = baseline.predicted_12_months * (1 + net_change)
        
        return ScenarioResult(
            scenario_type=ScenarioType.HOURS_CHANGE,
            baseline_earnings=baseline.predicted_12_months,
            projected_earnings=projected,
            earnings_change=projected - baseline.predicted_12_months,
            percentage_change=net_change * 100,
            time_to_impact=0,  # Immediate
            probability=0.9,
            key_assumptions=[
                f"Hours change by {hours_change*100:+.0f}%",
                "Sufficient project availability",
                "Health/productivity maintained"
            ],
            action_items=[
                "Adjust availability on profile",
                "Plan workload accordingly",
                "Consider time management tools"
            ]
        )
    
    async def _model_certification(
        self,
        baseline: EarningsPrediction,
        params: dict
    ) -> ScenarioResult:
        """Model getting a certification"""
        cert_name = params.get('certification', 'Professional Certification')
        
        # Certifications typically add 10-20% premium
        cert_premium = 0.15
        projected = baseline.predicted_12_months * (1 + cert_premium)
        
        return ScenarioResult(
            scenario_type=ScenarioType.CERTIFICATION,
            baseline_earnings=baseline.predicted_12_months,
            projected_earnings=projected,
            earnings_change=projected - baseline.predicted_12_months,
            percentage_change=cert_premium * 100,
            time_to_impact=60,  # Time to get certified
            probability=0.75,
            key_assumptions=[
                f"Successfully obtain {cert_name}",
                "Certification is recognized by clients",
                "Actively market new certification"
            ],
            action_items=[
                f"Study for {cert_name}",
                "Schedule certification exam",
                "Update profile and proposals to highlight cert"
            ]
        )
    
    async def _model_specialization(
        self,
        baseline: EarningsPrediction,
        params: dict
    ) -> ScenarioResult:
        """Model specializing in a niche"""
        niche = params.get('niche', 'specialty area')
        
        # Specialists can command 20-40% premium
        specialist_premium = 0.30
        projected = baseline.predicted_12_months * (1 + specialist_premium)
        
        return ScenarioResult(
            scenario_type=ScenarioType.SPECIALIZATION,
            baseline_earnings=baseline.predicted_12_months,
            projected_earnings=projected,
            earnings_change=projected - baseline.predicted_12_months,
            percentage_change=specialist_premium * 100,
            time_to_impact=180,  # Takes time to build reputation
            probability=0.6,
            key_assumptions=[
                f"Successful positioning as {niche} specialist",
                "Sufficient demand in niche",
                "Reduced competition justifies premium"
            ],
            action_items=[
                f"Focus portfolio on {niche} projects",
                "Create thought leadership content",
                "Target niche-specific clients",
                "Adjust profile messaging"
            ]
        )
    
    async def _model_generic(
        self,
        baseline: EarningsPrediction,
        params: dict
    ) -> ScenarioResult:
        """Model generic scenario"""
        impact = params.get('impact_percent', 10) / 100
        projected = baseline.predicted_12_months * (1 + impact)
        
        return ScenarioResult(
            scenario_type=ScenarioType.MARKET_SHIFT,
            baseline_earnings=baseline.predicted_12_months,
            projected_earnings=projected,
            earnings_change=projected - baseline.predicted_12_months,
            percentage_change=impact * 100,
            time_to_impact=90,
            probability=0.5,
            key_assumptions=["Based on provided parameters"],
            action_items=["Monitor situation and adapt"]
        )
    
    # -------------------------------------------------------------------------
    # GOAL FEASIBILITY
    # -------------------------------------------------------------------------
    
    async def check_goal_feasibility(
        self,
        user_id: str,
        target_earnings: float,
        target_date: datetime
    ) -> GoalFeasibility:
        """
        Check if an earnings goal is feasible
        """
        logger.info(f"Checking goal feasibility: ${target_earnings} by {target_date}")
        
        # Get prediction for target date
        months_ahead = max(1, (target_date - datetime.utcnow()).days // 30)
        prediction = await self.predict_earnings(user_id, months_ahead)
        
        # What we'd achieve on current trajectory
        trajectory_outcome = prediction.predicted_12_months if months_ahead >= 12 else prediction.predicted_6_months
        
        # Gap analysis
        gap = target_earnings - trajectory_outcome
        gap_percentage = (gap / trajectory_outcome) * 100 if trajectory_outcome > 0 else 0
        
        # Feasibility assessment
        if gap_percentage <= 0:
            is_feasible = True
            feasibility_score = 1.0
        elif gap_percentage <= 10:
            is_feasible = True
            feasibility_score = 0.9
        elif gap_percentage <= 25:
            is_feasible = True
            feasibility_score = 0.7
        elif gap_percentage <= 50:
            is_feasible = True
            feasibility_score = 0.5
        else:
            is_feasible = False
            feasibility_score = max(0.1, 0.5 - (gap_percentage - 50) / 100)
        
        # Generate required actions
        required_actions = await self._generate_required_actions(gap, gap_percentage)
        
        # Alternative targets
        alternatives = self._generate_alternatives(trajectory_outcome, target_date)
        
        self.metrics.increment('earnings_predictor.goal_checked')
        
        return GoalFeasibility(
            target_earnings=target_earnings,
            target_date=target_date,
            is_feasible=is_feasible,
            feasibility_score=feasibility_score,
            current_trajectory_outcome=trajectory_outcome,
            gap_to_goal=gap,
            required_actions=required_actions,
            risk_factors=[
                "Market conditions may change",
                "Client availability varies",
                "Personal capacity limits"
            ],
            alternative_targets=alternatives
        )
    
    async def _generate_required_actions(
        self,
        gap: float,
        gap_percentage: float
    ) -> list[dict]:
        """Generate actions needed to close the gap"""
        actions = []
        
        if gap_percentage > 0:
            actions.append({
                "action": "Increase hourly rate",
                "impact": f"Close {min(20, gap_percentage)}% of gap",
                "difficulty": "low"
            })
        
        if gap_percentage > 10:
            actions.append({
                "action": "Add high-demand skill",
                "impact": f"Close additional {min(25, gap_percentage - 10)}% of gap",
                "difficulty": "medium"
            })
        
        if gap_percentage > 25:
            actions.append({
                "action": "Increase working hours",
                "impact": f"Close additional {min(20, gap_percentage - 25)}% of gap",
                "difficulty": "medium"
            })
        
        if gap_percentage > 40:
            actions.append({
                "action": "Target higher-budget clients",
                "impact": f"Close additional {gap_percentage - 40}% of gap",
                "difficulty": "high"
            })
        
        return actions
    
    def _generate_alternatives(
        self,
        trajectory: float,
        target_date: datetime
    ) -> list[dict]:
        """Generate alternative achievable targets"""
        return [
            {
                "target": trajectory * 0.9,
                "feasibility": "very likely",
                "description": "Conservative target (90% of trajectory)"
            },
            {
                "target": trajectory,
                "feasibility": "likely",
                "description": "Current trajectory outcome"
            },
            {
                "target": trajectory * 1.15,
                "feasibility": "achievable",
                "description": "Stretch target (115% of trajectory)"
            }
        ]


# =============================================================================
# FACTORY
# =============================================================================

_predictor: Optional[EarningsPredictor] = None

def get_earnings_predictor() -> EarningsPredictor:
    """Get EarningsPredictor singleton"""
    global _predictor
    if _predictor is None:
        from app.data.market_data import get_market_data
        from app.metrics import get_metrics
        
        _predictor = EarningsPredictor(
            market_data=get_market_data(),
            metrics=get_metrics()
        )
    return _predictor
