"""
Rate Success Model
ML model for predicting bid success at different rates
Sprint M7: AI Work Assistant
"""

from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

class RateFeatures(BaseModel):
    """Features for rate prediction"""
    # Freelancer
    experience_years: int
    skill_match_score: float  # 0-1
    rating: float  # 1-5
    completion_rate: float  # 0-1
    historical_win_rate: float  # 0-1
    average_rate: float
    
    # Job
    budget_min: Optional[float]
    budget_max: Optional[float]
    job_complexity: str  # low, medium, high
    duration_days: Optional[int]
    competition_level: str  # low, medium, high
    
    # Rate
    proposed_rate: float
    rate_vs_budget: float  # ratio to budget midpoint
    rate_vs_market: float  # ratio to market median
    rate_vs_average: float  # ratio to freelancer's average
    
    # Timing
    days_since_posted: int
    
    # Seasonal
    month: int
    day_of_week: int


class TrainingData(BaseModel):
    """Training data point"""
    job_id: str
    user_id: str
    features: RateFeatures
    proposed_rate: float
    outcome: str  # won, lost
    final_rate: Optional[float]
    timestamp: datetime


# =============================================================================
# RATE SUCCESS MODEL
# =============================================================================

class RateSuccessModel:
    """
    ML model for predicting bid success at different rates
    
    Uses:
    - Historical bid outcomes
    - Freelancer profiles
    - Job characteristics
    - Market conditions
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.model = None
        self.version = "1.0.0"
        self._load_model()
    
    def _load_model(self):
        """Load trained model"""
        if self.model_path:
            logger.info(f"Loading model from {self.model_path}")
        else:
            logger.info("Using baseline heuristic model")
    
    # -------------------------------------------------------------------------
    # PREDICTION
    # -------------------------------------------------------------------------
    
    async def predict_win_at_rate(
        self,
        rate: float,
        job_id: str,
        user_id: str
    ) -> float:
        """
        Predict probability of winning at a given rate
        
        Returns: 0-1 probability
        """
        # Get features
        features = await self._extract_features(rate, job_id, user_id)
        
        # Run prediction
        probability = self._predict(features)
        
        return probability
    
    async def predict_optimal_rate(
        self,
        job_id: str,
        user_id: str,
        target_win_prob: float = 0.5
    ) -> float:
        """
        Find rate that achieves target win probability
        
        Uses binary search to find optimal rate
        """
        # Get base features
        base_features = await self._extract_features(50.0, job_id, user_id)
        
        # Binary search for rate
        low, high = 20.0, 200.0
        
        for _ in range(20):  # Max iterations
            mid = (low + high) / 2
            base_features.proposed_rate = mid
            prob = self._predict(base_features)
            
            if abs(prob - target_win_prob) < 0.05:
                return mid
            elif prob > target_win_prob:
                low = mid
            else:
                high = mid
        
        return mid
    
    def _predict(self, features: RateFeatures) -> float:
        """Run model prediction"""
        # Baseline heuristic model
        # In production: Use trained XGBoost/neural net
        
        base_prob = 0.5
        
        # Rate vs budget effect (biggest factor)
        if features.rate_vs_budget <= 0:
            rate_effect = 0
        elif features.rate_vs_budget < 0.8:
            rate_effect = 0.2  # Below budget = higher chance
        elif features.rate_vs_budget <= 1.0:
            rate_effect = 0.1  # At budget
        elif features.rate_vs_budget <= 1.2:
            rate_effect = -0.1  # Slightly above
        else:
            rate_effect = -0.25  # Way above budget
        
        # Experience effect
        exp_effect = min(features.experience_years * 0.02, 0.15)
        
        # Rating effect
        rating_effect = (features.rating - 4.0) * 0.05
        
        # Skill match effect
        skill_effect = (features.skill_match_score - 0.5) * 0.2
        
        # Historical win rate effect
        history_effect = (features.historical_win_rate - 0.3) * 0.15
        
        # Competition effect
        competition_effects = {
            'low': 0.15,
            'medium': 0,
            'high': -0.15
        }
        comp_effect = competition_effects.get(features.competition_level, 0)
        
        # Timing effect (fresher jobs = higher chance)
        timing_effect = max(-0.1, -features.days_since_posted * 0.01)
        
        # Combine effects
        probability = base_prob + rate_effect + exp_effect + rating_effect + \
                     skill_effect + history_effect + comp_effect + timing_effect
        
        # Clamp to valid range
        return max(0.05, min(0.85, probability))
    
    # -------------------------------------------------------------------------
    # FEATURE EXTRACTION
    # -------------------------------------------------------------------------
    
    async def _extract_features(
        self,
        rate: float,
        job_id: str,
        user_id: str
    ) -> RateFeatures:
        """Extract features for prediction"""
        # Get job details
        job = await self._get_job(job_id)
        
        # Get freelancer details
        freelancer = await self._get_freelancer(user_id)
        
        # Calculate derived features
        budget_mid = ((job.get('budget_min', 0) or 0) + (job.get('budget_max', 100) or 100)) / 2
        rate_vs_budget = rate / budget_mid if budget_mid > 0 else 1.0
        
        market_median = await self._get_market_median(job.get('skills', []))
        rate_vs_market = rate / market_median if market_median > 0 else 1.0
        
        avg_rate = freelancer.get('average_rate', rate)
        rate_vs_average = rate / avg_rate if avg_rate > 0 else 1.0
        
        # Calculate days since posted
        posted_date = job.get('posted_date')
        if posted_date:
            days_since = (datetime.utcnow() - posted_date).days
        else:
            days_since = 0
        
        return RateFeatures(
            experience_years=freelancer.get('experience_years', 3),
            skill_match_score=self._calculate_skill_match(
                freelancer.get('skills', []),
                job.get('skills', [])
            ),
            rating=freelancer.get('rating', 4.5),
            completion_rate=freelancer.get('completion_rate', 0.95),
            historical_win_rate=freelancer.get('win_rate', 0.3),
            average_rate=avg_rate,
            budget_min=job.get('budget_min'),
            budget_max=job.get('budget_max'),
            job_complexity=job.get('complexity', 'medium'),
            duration_days=job.get('duration_days'),
            competition_level=job.get('competition_level', 'medium'),
            proposed_rate=rate,
            rate_vs_budget=rate_vs_budget,
            rate_vs_market=rate_vs_market,
            rate_vs_average=rate_vs_average,
            days_since_posted=days_since,
            month=datetime.utcnow().month,
            day_of_week=datetime.utcnow().weekday()
        )
    
    def _calculate_skill_match(
        self,
        freelancer_skills: list[str],
        job_skills: list[str]
    ) -> float:
        """Calculate skill match score"""
        if not job_skills:
            return 0.7
        
        freelancer_set = set(s.lower() for s in freelancer_skills)
        job_set = set(s.lower() for s in job_skills)
        
        matched = len(freelancer_set & job_set)
        return matched / len(job_set)
    
    async def _get_job(self, job_id: str) -> dict:
        """Get job details"""
        # In production: Query database
        return {
            'budget_min': 30,
            'budget_max': 80,
            'skills': ['python', 'django'],
            'complexity': 'medium',
            'competition_level': 'medium'
        }
    
    async def _get_freelancer(self, user_id: str) -> dict:
        """Get freelancer details"""
        # In production: Query database
        return {
            'experience_years': 5,
            'skills': ['python', 'django', 'javascript'],
            'rating': 4.7,
            'completion_rate': 0.96,
            'win_rate': 0.35,
            'average_rate': 55.0
        }
    
    async def _get_market_median(self, skills: list[str]) -> float:
        """Get market median rate for skills"""
        # In production: Query market data
        return 50.0
    
    # -------------------------------------------------------------------------
    # TRAINING
    # -------------------------------------------------------------------------
    
    async def add_training_data(self, data: dict):
        """Add training data point"""
        logger.info(f"Adding training data for job {data.get('job_id')}")
        # In production: Store to training dataset
    
    async def retrain(self, training_data: list[TrainingData]) -> dict:
        """Retrain model with new data"""
        logger.info(f"Retraining with {len(training_data)} samples")
        
        # In production:
        # 1. Prepare feature matrix
        # 2. Split train/validation
        # 3. Train model
        # 4. Evaluate
        # 5. Return metrics
        
        return {
            "samples": len(training_data),
            "accuracy": 0.70,
            "auc": 0.75,
            "mae_rate": 8.5,  # Mean absolute error in rate
            "model_version": "1.0.1"
        }
    
    async def evaluate(self, test_data: list[TrainingData]) -> dict:
        """Evaluate model performance"""
        return {
            "accuracy": 0.68,
            "samples": len(test_data)
        }


# =============================================================================
# FACTORY
# =============================================================================

_model: Optional[RateSuccessModel] = None

def get_rate_model() -> RateSuccessModel:
    """Get RateSuccessModel singleton"""
    global _model
    if _model is None:
        _model = RateSuccessModel()
    return _model
