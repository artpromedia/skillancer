"""
Rate Optimizer Service
AI-powered rate recommendations for freelancers
Sprint M7: AI Work Assistant
"""

from typing import Optional
from pydantic import BaseModel
from enum import Enum
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

class RateStrategy(str, Enum):
    COMPETITIVE = "competitive"  # Win-focused, lower rate
    BALANCED = "balanced"  # Balance win rate and earnings
    PREMIUM = "premium"  # Maximize earnings, accept lower win rate


class RateRecommendation(BaseModel):
    """Recommended rate with explanation"""
    recommended_rate: float
    rate_range: tuple[float, float]  # min, max
    win_probability: float
    expected_value: float  # rate * win_probability
    confidence: float
    reasoning: list[str]
    alternative_strategies: list[dict]


class RateAnalysis(BaseModel):
    """Analysis of a proposed rate"""
    proposed_rate: float
    win_probability: float
    market_position: str  # below, at, above
    market_percentile: int  # 0-100
    competitive_analysis: dict
    recommendations: list[str]


class MarketRateData(BaseModel):
    """Market rate information"""
    skill: str
    experience_level: str
    percentile_25: float
    percentile_50: float
    percentile_75: float
    percentile_90: float
    sample_size: int
    last_updated: datetime


class FreelancerProfile(BaseModel):
    """Freelancer profile for rate optimization"""
    user_id: str
    skills: list[str]
    experience_years: int
    rating: float
    completion_rate: float
    win_rate: float
    average_rate: float
    rate_history: list[dict]


class JobContext(BaseModel):
    """Job context for rate optimization"""
    job_id: str
    title: str
    skills_required: list[str]
    budget_min: Optional[float]
    budget_max: Optional[float]
    duration: Optional[str]
    client_history: dict
    competition_level: str


# =============================================================================
# RATE OPTIMIZER SERVICE
# =============================================================================

class RateOptimizerService:
    """
    AI-powered rate optimization
    
    Analyzes freelancer profile, job requirements, market rates,
    and historical win rates to recommend optimal pricing.
    """
    
    def __init__(self, rate_model, market_data, metrics):
        self.model = rate_model
        self.market = market_data
        self.metrics = metrics
    
    # -------------------------------------------------------------------------
    # RATE RECOMMENDATION
    # -------------------------------------------------------------------------
    
    async def get_optimal_rate(
        self,
        job: JobContext,
        freelancer: FreelancerProfile,
        strategy: RateStrategy = RateStrategy.BALANCED
    ) -> RateRecommendation:
        """
        Get optimal rate recommendation for a job
        
        Considers:
        - Freelancer's skills and experience
        - Job requirements
        - Client budget signals
        - Market rates
        - Historical win rates at different prices
        """
        logger.info(f"Getting optimal rate for job {job.job_id}")
        
        # Get market rate for relevant skills
        market_rates = await self._get_market_rates(job.skills_required)
        
        # Calculate skill match
        skill_match = self._calculate_skill_match(freelancer.skills, job.skills_required)
        
        # Get base rate range
        base_range = self._calculate_base_range(
            freelancer, market_rates, skill_match
        )
        
        # Adjust for job-specific factors
        adjusted_range = self._adjust_for_job(base_range, job, freelancer)
        
        # Get win probabilities at different rates
        rate_curve = await self._calculate_win_curve(
            adjusted_range, job, freelancer
        )
        
        # Select optimal rate based on strategy
        optimal = self._select_optimal_rate(rate_curve, strategy)
        
        # Generate reasoning
        reasoning = self._generate_reasoning(
            optimal, market_rates, job, freelancer
        )
        
        # Get alternative strategies
        alternatives = self._get_alternatives(rate_curve, strategy)
        
        self.metrics.increment('rate_optimizer.recommendation_generated')
        
        return RateRecommendation(
            recommended_rate=optimal['rate'],
            rate_range=(adjusted_range['min'], adjusted_range['max']),
            win_probability=optimal['win_prob'],
            expected_value=optimal['expected_value'],
            confidence=optimal['confidence'],
            reasoning=reasoning,
            alternative_strategies=alternatives
        )
    
    async def _get_market_rates(self, skills: list[str]) -> dict:
        """Get market rates for skills"""
        rates = {}
        for skill in skills:
            market_data = await self.market.get_rate_data(skill)
            if market_data:
                rates[skill] = market_data
        
        # If no data, use defaults
        if not rates:
            rates['default'] = MarketRateData(
                skill='default',
                experience_level='mid',
                percentile_25=35.0,
                percentile_50=50.0,
                percentile_75=75.0,
                percentile_90=100.0,
                sample_size=100,
                last_updated=datetime.utcnow()
            )
        
        return rates
    
    def _calculate_skill_match(
        self,
        freelancer_skills: list[str],
        required_skills: list[str]
    ) -> float:
        """Calculate how well freelancer matches job skills"""
        if not required_skills:
            return 0.7  # Default match
        
        freelancer_set = set(s.lower() for s in freelancer_skills)
        required_set = set(s.lower() for s in required_skills)
        
        matched = len(freelancer_set & required_set)
        return matched / len(required_set)
    
    def _calculate_base_range(
        self,
        freelancer: FreelancerProfile,
        market_rates: dict,
        skill_match: float
    ) -> dict:
        """Calculate base rate range"""
        # Get median market rate
        median_rates = [
            data.percentile_50 
            for data in market_rates.values()
            if isinstance(data, MarketRateData)
        ]
        base_median = sum(median_rates) / len(median_rates) if median_rates else 50.0
        
        # Adjust for experience
        experience_multiplier = 1 + (freelancer.experience_years * 0.05)
        experience_multiplier = min(experience_multiplier, 2.0)  # Cap at 2x
        
        # Adjust for rating
        rating_multiplier = 0.9 + (freelancer.rating / 50)  # 4.5 rating = 0.99x
        
        # Adjust for skill match
        skill_multiplier = 0.8 + (skill_match * 0.4)  # 80% to 120%
        
        # Calculate adjusted median
        adjusted_median = base_median * experience_multiplier * rating_multiplier * skill_multiplier
        
        return {
            'min': adjusted_median * 0.7,
            'max': adjusted_median * 1.4,
            'median': adjusted_median
        }
    
    def _adjust_for_job(
        self,
        base_range: dict,
        job: JobContext,
        freelancer: FreelancerProfile
    ) -> dict:
        """Adjust range for job-specific factors"""
        adjusted = base_range.copy()
        
        # Adjust for budget if known
        if job.budget_max:
            # Don't recommend above max budget
            adjusted['max'] = min(adjusted['max'], job.budget_max * 1.1)
        
        if job.budget_min:
            # Don't go too far below min budget
            adjusted['min'] = max(adjusted['min'], job.budget_min * 0.85)
        
        # Adjust for competition
        if job.competition_level == 'high':
            adjusted['min'] *= 0.9
            adjusted['median'] *= 0.95
        elif job.competition_level == 'low':
            adjusted['median'] *= 1.1
            adjusted['max'] *= 1.15
        
        # Adjust for client history (repeat clients = premium)
        if job.client_history.get('previous_contracts', 0) > 0:
            adjusted['median'] *= 1.1
        
        return adjusted
    
    async def _calculate_win_curve(
        self,
        rate_range: dict,
        job: JobContext,
        freelancer: FreelancerProfile
    ) -> list[dict]:
        """Calculate win probability at different rates"""
        curve = []
        
        # Sample rates across range
        min_rate = rate_range['min']
        max_rate = rate_range['max']
        step = (max_rate - min_rate) / 10
        
        for i in range(11):
            rate = min_rate + (step * i)
            win_prob = await self.model.predict_win_at_rate(
                rate=rate,
                job_id=job.job_id,
                user_id=freelancer.user_id
            )
            expected_value = rate * win_prob
            
            curve.append({
                'rate': round(rate, 2),
                'win_prob': win_prob,
                'expected_value': round(expected_value, 2)
            })
        
        return curve
    
    def _select_optimal_rate(
        self,
        curve: list[dict],
        strategy: RateStrategy
    ) -> dict:
        """Select optimal rate based on strategy"""
        if strategy == RateStrategy.COMPETITIVE:
            # Maximize win probability (lower rates)
            optimal = max(curve, key=lambda x: x['win_prob'])
        elif strategy == RateStrategy.PREMIUM:
            # Maximize rate with acceptable win probability (>30%)
            viable = [p for p in curve if p['win_prob'] >= 0.3]
            optimal = max(viable, key=lambda x: x['rate']) if viable else curve[5]
        else:  # BALANCED
            # Maximize expected value
            optimal = max(curve, key=lambda x: x['expected_value'])
        
        optimal['confidence'] = 0.75  # Base confidence
        return optimal
    
    def _generate_reasoning(
        self,
        optimal: dict,
        market_rates: dict,
        job: JobContext,
        freelancer: FreelancerProfile
    ) -> list[str]:
        """Generate explanation for recommendation"""
        reasons = []
        
        reasons.append(
            f"Based on market data for {', '.join(job.skills_required[:3])}"
        )
        
        if freelancer.experience_years > 5:
            reasons.append(
                f"Adjusted up for your {freelancer.experience_years} years experience"
            )
        
        if freelancer.rating >= 4.5:
            reasons.append(
                f"Your {freelancer.rating} rating commands a premium"
            )
        
        if job.budget_max:
            if optimal['rate'] < job.budget_max:
                reasons.append(
                    f"Positioned within client's budget (${job.budget_max}/hr)"
                )
            else:
                reasons.append(
                    f"Above stated budget - justify with premium value"
                )
        
        if job.competition_level == 'high':
            reasons.append(
                "Competitive rate due to high competition"
            )
        
        reasons.append(
            f"Expected {optimal['win_prob']*100:.0f}% chance of winning at this rate"
        )
        
        return reasons
    
    def _get_alternatives(
        self,
        curve: list[dict],
        current_strategy: RateStrategy
    ) -> list[dict]:
        """Get alternative rate strategies"""
        alternatives = []
        
        for strategy in RateStrategy:
            if strategy == current_strategy:
                continue
            
            if strategy == RateStrategy.COMPETITIVE:
                point = max(curve, key=lambda x: x['win_prob'])
                alternatives.append({
                    'strategy': 'competitive',
                    'rate': point['rate'],
                    'win_probability': point['win_prob'],
                    'description': 'Lower rate, higher chance of winning'
                })
            elif strategy == RateStrategy.PREMIUM:
                viable = [p for p in curve if p['win_prob'] >= 0.3]
                if viable:
                    point = max(viable, key=lambda x: x['rate'])
                    alternatives.append({
                        'strategy': 'premium',
                        'rate': point['rate'],
                        'win_probability': point['win_prob'],
                        'description': 'Higher rate, maximize earnings per project'
                    })
            else:  # BALANCED
                point = max(curve, key=lambda x: x['expected_value'])
                alternatives.append({
                    'strategy': 'balanced',
                    'rate': point['rate'],
                    'win_probability': point['win_prob'],
                    'description': 'Best balance of rate and win probability'
                })
        
        return alternatives
    
    # -------------------------------------------------------------------------
    # RATE ANALYSIS
    # -------------------------------------------------------------------------
    
    async def analyze_rate(
        self,
        proposed_rate: float,
        job: JobContext,
        freelancer: FreelancerProfile
    ) -> RateAnalysis:
        """
        Analyze a proposed rate
        
        Returns win probability and market position
        """
        logger.info(f"Analyzing rate ${proposed_rate}")
        
        # Get market rates
        market_rates = await self._get_market_rates(job.skills_required)
        
        # Calculate market position
        market_data = list(market_rates.values())[0] if market_rates else None
        if market_data and isinstance(market_data, MarketRateData):
            if proposed_rate < market_data.percentile_25:
                position = 'below'
                percentile = 25
            elif proposed_rate < market_data.percentile_50:
                position = 'below'
                percentile = 35
            elif proposed_rate < market_data.percentile_75:
                position = 'at'
                percentile = 55
            elif proposed_rate < market_data.percentile_90:
                position = 'above'
                percentile = 80
            else:
                position = 'above'
                percentile = 95
        else:
            position = 'at'
            percentile = 50
        
        # Predict win probability
        win_prob = await self.model.predict_win_at_rate(
            rate=proposed_rate,
            job_id=job.job_id,
            user_id=freelancer.user_id
        )
        
        # Generate recommendations
        recommendations = []
        if win_prob < 0.3:
            recommendations.append("Consider lowering rate to improve chances")
        if position == 'below':
            recommendations.append("Your rate is below market - you could charge more")
        if position == 'above' and win_prob < 0.5:
            recommendations.append("Rate is above market - ensure proposal shows premium value")
        
        self.metrics.increment('rate_optimizer.rate_analyzed')
        
        return RateAnalysis(
            proposed_rate=proposed_rate,
            win_probability=win_prob,
            market_position=position,
            market_percentile=percentile,
            competitive_analysis={
                'average_winning_rate': 50.0,
                'proposals_at_this_rate': 15,
                'win_rate_at_this_price': win_prob
            },
            recommendations=recommendations
        )
    
    # -------------------------------------------------------------------------
    # MARKET RATES
    # -------------------------------------------------------------------------
    
    async def get_market_rate(self, skill: str) -> Optional[MarketRateData]:
        """Get market rate for a specific skill"""
        return await self.market.get_rate_data(skill)
    
    # -------------------------------------------------------------------------
    # FEEDBACK LOOP
    # -------------------------------------------------------------------------
    
    async def record_outcome(
        self,
        job_id: str,
        proposed_rate: float,
        outcome: str,  # won, lost
        final_rate: Optional[float] = None
    ):
        """Record bid outcome for model training"""
        logger.info(f"Recording outcome: job={job_id}, outcome={outcome}")
        
        await self.model.add_training_data({
            'job_id': job_id,
            'proposed_rate': proposed_rate,
            'final_rate': final_rate,
            'outcome': outcome,
            'timestamp': datetime.utcnow().isoformat()
        })
        
        self.metrics.increment('rate_optimizer.outcome_recorded', tags={'outcome': outcome})


# =============================================================================
# FACTORY
# =============================================================================

_service: Optional[RateOptimizerService] = None

def get_rate_optimizer_service() -> RateOptimizerService:
    """Get RateOptimizerService singleton"""
    global _service
    if _service is None:
        from app.models.rate_model import get_rate_model
        from app.data.market_data import get_market_data
        from app.metrics import get_metrics
        
        _service = RateOptimizerService(
            rate_model=get_rate_model(),
            market_data=get_market_data(),
            metrics=get_metrics()
        )
    return _service
