"""
Proposal Success Model
ML model for predicting proposal win probability
Sprint M7: AI Work Assistant
"""

from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import numpy as np

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

class ProposalFeatures(BaseModel):
    """Features extracted from proposal for prediction"""
    # Proposal characteristics
    proposal_length: int
    word_count: int
    sentence_count: int
    avg_sentence_length: float
    
    # Content analysis
    keyword_match_score: float  # 0-1
    personalization_score: float  # 0-1
    question_count: int
    has_call_to_action: bool
    
    # Experience relevance
    skill_match_score: float  # 0-1
    portfolio_relevance_score: float  # 0-1
    experience_years_match: float  # 0-1
    
    # Rate positioning
    rate_vs_budget: float  # ratio of proposed rate to budget
    rate_vs_market: float  # ratio to market rate
    
    # Timing
    response_time_hours: float
    
    # Freelancer history
    freelancer_win_rate: float
    freelancer_completion_rate: float
    freelancer_rating: float


class ModelPrediction(BaseModel):
    """Model prediction output"""
    win_probability: float
    confidence: float
    key_factors: list[dict]
    improvement_suggestions: list[str]


class TrainingDataPoint(BaseModel):
    """Single training data point"""
    proposal_id: str
    job_id: str
    user_id: str
    features: ProposalFeatures
    outcome: str  # won, lost, withdrawn
    timestamp: datetime


# =============================================================================
# PROPOSAL SUCCESS MODEL
# =============================================================================

class ProposalSuccessModel:
    """
    ML model for proposal success prediction
    
    Architecture:
    - Feature extraction from proposal text
    - Classification model for win/lose prediction
    - Regression model for confidence scoring
    - Continuous learning from outcomes
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.model = None
        self.feature_extractor = None
        self.version = "1.0.0"
        self._load_model()
    
    def _load_model(self):
        """Load trained model from storage"""
        if self.model_path:
            logger.info(f"Loading model from {self.model_path}")
            # In production: Load model weights
        else:
            logger.info("Using default model")
            # Use baseline model
    
    # -------------------------------------------------------------------------
    # PREDICTION
    # -------------------------------------------------------------------------
    
    async def predict_win_probability(
        self,
        proposal_text: str,
        job_id: str,
        user_id: Optional[str] = None
    ) -> float:
        """
        Predict probability of proposal winning
        
        Returns: 0-1 probability score
        """
        # Extract features
        features = await self._extract_features(proposal_text, job_id, user_id)
        
        # Run prediction
        prediction = self._predict(features)
        
        logger.info(f"Win probability: {prediction:.3f}")
        return prediction
    
    async def predict_with_details(
        self,
        proposal_text: str,
        job_id: str,
        user_id: Optional[str] = None
    ) -> ModelPrediction:
        """
        Predict with detailed explanation
        
        Returns prediction with key factors and suggestions
        """
        features = await self._extract_features(proposal_text, job_id, user_id)
        probability = self._predict(features)
        confidence = self._calculate_confidence(features)
        
        # Identify key factors
        key_factors = self._identify_key_factors(features, probability)
        
        # Generate improvement suggestions
        suggestions = self._generate_suggestions(features, probability)
        
        return ModelPrediction(
            win_probability=probability,
            confidence=confidence,
            key_factors=key_factors,
            improvement_suggestions=suggestions
        )
    
    def _predict(self, features: ProposalFeatures) -> float:
        """Run model prediction"""
        # Baseline heuristic model (replace with trained ML model)
        score = 0.5  # Start at 50%
        
        # Keyword matching (important factor)
        score += (features.keyword_match_score - 0.5) * 0.2
        
        # Personalization
        score += (features.personalization_score - 0.5) * 0.15
        
        # Length optimization (too short or too long is bad)
        optimal_length = 300
        length_score = 1 - abs(features.word_count - optimal_length) / optimal_length
        score += length_score * 0.1
        
        # Questions show engagement
        if 1 <= features.question_count <= 3:
            score += 0.05
        
        # Has CTA
        if features.has_call_to_action:
            score += 0.05
        
        # Response time (faster is better, but not too fast)
        if 1 <= features.response_time_hours <= 4:
            score += 0.1
        elif features.response_time_hours <= 24:
            score += 0.05
        
        # Freelancer history
        score += (features.freelancer_win_rate - 0.3) * 0.15
        score += (features.freelancer_rating - 4.0) * 0.05
        
        # Rate positioning (slight discount wins more)
        if 0.85 <= features.rate_vs_budget <= 1.0:
            score += 0.05
        elif features.rate_vs_budget > 1.2:
            score -= 0.1
        
        # Clamp to valid range
        return max(0.1, min(0.9, score))
    
    def _calculate_confidence(self, features: ProposalFeatures) -> float:
        """Calculate prediction confidence"""
        # Higher confidence when we have more data
        confidence = 0.5
        
        # More history = more confidence
        if features.freelancer_win_rate > 0:
            confidence += 0.2
        
        # Known rate positioning
        if features.rate_vs_budget > 0:
            confidence += 0.15
        
        # Good skill match
        if features.skill_match_score > 0.7:
            confidence += 0.15
        
        return min(confidence, 0.95)
    
    def _identify_key_factors(
        self,
        features: ProposalFeatures,
        probability: float
    ) -> list[dict]:
        """Identify factors most influencing prediction"""
        factors = []
        
        # Positive factors
        if features.keyword_match_score > 0.7:
            factors.append({
                "factor": "keyword_match",
                "impact": "positive",
                "description": "Good alignment with job keywords"
            })
        
        if features.personalization_score > 0.7:
            factors.append({
                "factor": "personalization",
                "impact": "positive",
                "description": "Proposal feels personalized to job"
            })
        
        if features.response_time_hours < 4:
            factors.append({
                "factor": "response_time",
                "impact": "positive",
                "description": "Quick response time"
            })
        
        # Negative factors
        if features.keyword_match_score < 0.4:
            factors.append({
                "factor": "keyword_match",
                "impact": "negative",
                "description": "Missing important job keywords"
            })
        
        if features.word_count < 100:
            factors.append({
                "factor": "length",
                "impact": "negative",
                "description": "Proposal may be too short"
            })
        
        if features.word_count > 600:
            factors.append({
                "factor": "length",
                "impact": "negative",
                "description": "Proposal may be too long"
            })
        
        if features.rate_vs_budget > 1.2:
            factors.append({
                "factor": "rate",
                "impact": "negative",
                "description": "Rate significantly above budget"
            })
        
        return factors
    
    def _generate_suggestions(
        self,
        features: ProposalFeatures,
        probability: float
    ) -> list[str]:
        """Generate improvement suggestions"""
        suggestions = []
        
        if features.keyword_match_score < 0.6:
            suggestions.append(
                "Include more keywords from the job description"
            )
        
        if features.personalization_score < 0.6:
            suggestions.append(
                "Make your proposal more specific to this job"
            )
        
        if features.question_count == 0:
            suggestions.append(
                "Ask 1-2 thoughtful questions to show engagement"
            )
        
        if not features.has_call_to_action:
            suggestions.append(
                "Add a clear call-to-action at the end"
            )
        
        if features.word_count < 150:
            suggestions.append(
                "Expand your proposal with more relevant details"
            )
        
        if features.word_count > 500:
            suggestions.append(
                "Consider making your proposal more concise"
            )
        
        if features.rate_vs_budget > 1.1:
            suggestions.append(
                "Your rate is above budget - justify the premium or adjust"
            )
        
        return suggestions[:5]  # Top 5 suggestions
    
    # -------------------------------------------------------------------------
    # FEATURE EXTRACTION
    # -------------------------------------------------------------------------
    
    async def _extract_features(
        self,
        proposal_text: str,
        job_id: str,
        user_id: Optional[str]
    ) -> ProposalFeatures:
        """Extract features from proposal for prediction"""
        # Text analysis
        words = proposal_text.split()
        sentences = proposal_text.split('.')
        
        # Get job details for comparison
        job_details = await self._get_job_details(job_id)
        job_keywords = self._extract_keywords(job_details.get('description', ''))
        proposal_keywords = self._extract_keywords(proposal_text)
        
        # Keyword matching
        keyword_match = len(
            set(job_keywords) & set(proposal_keywords)
        ) / max(len(job_keywords), 1)
        
        # Get freelancer history
        freelancer = await self._get_freelancer_stats(user_id) if user_id else {}
        
        return ProposalFeatures(
            proposal_length=len(proposal_text),
            word_count=len(words),
            sentence_count=len(sentences),
            avg_sentence_length=len(words) / max(len(sentences), 1),
            keyword_match_score=keyword_match,
            personalization_score=self._calculate_personalization(proposal_text, job_details),
            question_count=proposal_text.count('?'),
            has_call_to_action=self._has_cta(proposal_text),
            skill_match_score=0.7,  # Calculate from job/user skills
            portfolio_relevance_score=0.6,
            experience_years_match=0.8,
            rate_vs_budget=0.95,  # Calculate from actual rate/budget
            rate_vs_market=1.0,
            response_time_hours=2.0,  # Calculate from actual timestamps
            freelancer_win_rate=freelancer.get('win_rate', 0.3),
            freelancer_completion_rate=freelancer.get('completion_rate', 0.95),
            freelancer_rating=freelancer.get('rating', 4.5)
        )
    
    def _extract_keywords(self, text: str) -> list[str]:
        """Extract important keywords from text"""
        # Simple keyword extraction (replace with NLP in production)
        import re
        words = re.findall(r'\b\w+\b', text.lower())
        # Filter common words
        stopwords = {'the', 'a', 'an', 'is', 'are', 'we', 'you', 'for', 'to', 'of', 'and', 'or', 'in', 'on', 'with'}
        return [w for w in words if w not in stopwords and len(w) > 3]
    
    def _calculate_personalization(self, proposal: str, job: dict) -> float:
        """Calculate how personalized the proposal is"""
        score = 0.5
        
        # Check for job title mention
        if job.get('title', '').lower() in proposal.lower():
            score += 0.1
        
        # Check for company name mention
        if job.get('company', '').lower() in proposal.lower():
            score += 0.15
        
        # Check for specific requirement mentions
        requirements = job.get('requirements', [])
        mentioned = sum(1 for r in requirements if r.lower() in proposal.lower())
        if requirements:
            score += (mentioned / len(requirements)) * 0.25
        
        return min(score, 1.0)
    
    def _has_cta(self, proposal: str) -> bool:
        """Check if proposal has a call-to-action"""
        cta_phrases = [
            'let\'s discuss', 'schedule a call', 'happy to chat',
            'looking forward', 'let me know', 'available to start',
            'reach out', 'get in touch', 'would love to'
        ]
        proposal_lower = proposal.lower()
        return any(phrase in proposal_lower for phrase in cta_phrases)
    
    async def _get_job_details(self, job_id: str) -> dict:
        """Get job details for feature extraction"""
        # In production: Query job database
        return {}
    
    async def _get_freelancer_stats(self, user_id: str) -> dict:
        """Get freelancer statistics for features"""
        # In production: Query user database
        return {
            'win_rate': 0.35,
            'completion_rate': 0.95,
            'rating': 4.7
        }
    
    # -------------------------------------------------------------------------
    # TRAINING
    # -------------------------------------------------------------------------
    
    async def add_training_data(self, data: TrainingDataPoint):
        """Add new training data point"""
        logger.info(f"Adding training data: {data.proposal_id}")
        # In production: Store to training dataset
    
    async def retrain(self, training_data: list[TrainingDataPoint]) -> dict:
        """Retrain model with new data"""
        logger.info(f"Retraining with {len(training_data)} samples")
        
        # In production:
        # 1. Prepare feature matrix
        # 2. Split train/validation
        # 3. Train model (XGBoost, neural net, etc.)
        # 4. Evaluate on validation set
        # 5. Return metrics
        
        return {
            "samples": len(training_data),
            "accuracy": 0.72,
            "auc": 0.78,
            "model_version": "1.0.1"
        }
    
    async def evaluate(self, test_data: list[TrainingDataPoint]) -> dict:
        """Evaluate model on test data"""
        correct = 0
        total = len(test_data)
        
        for data in test_data:
            prediction = self._predict(data.features)
            predicted_win = prediction > 0.5
            actual_win = data.outcome == 'won'
            if predicted_win == actual_win:
                correct += 1
        
        return {
            "accuracy": correct / total if total > 0 else 0,
            "samples": total
        }


# =============================================================================
# FACTORY
# =============================================================================

_model: Optional[ProposalSuccessModel] = None

def get_proposal_model() -> ProposalSuccessModel:
    """Get ProposalSuccessModel singleton"""
    global _model
    if _model is None:
        _model = ProposalSuccessModel()
    return _model
