"""
Model Service - Manages ML models and inference.
"""

import structlog
from typing import List, Dict, Any, Optional
import numpy as np
from pathlib import Path

from app.core.config import settings
from app.schemas import (
    UserContext,
    MarketSignal,
    RecommendationItem,
    RecommendationType,
    ContentType,
    SkillGapItem,
    GapPriority,
    TrendForecast,
    TrendDirection,
)

logger = structlog.get_logger()


class ModelService:
    """Service for managing and running ML models."""
    
    def __init__(self):
        self.recommendation_model = None
        self.skill_gap_model = None
        self.trend_model = None
        self.embedding_model = None
        self.content_embeddings = {}
        self.skill_embeddings = {}
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize and load ML models."""
        logger.info("Initializing ML models")
        
        try:
            # Load embedding model
            await self._load_embedding_model()
            
            # Load recommendation model
            await self._load_recommendation_model()
            
            # Load skill gap analysis model
            await self._load_skill_gap_model()
            
            # Load trend forecasting model
            await self._load_trend_model()
            
            self._initialized = True
            logger.info("All ML models initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize ML models", error=str(e))
            # Continue with rule-based fallback
            self._initialized = True
    
    async def _load_embedding_model(self) -> None:
        """Load sentence transformer for embeddings."""
        try:
            from sentence_transformers import SentenceTransformer
            model_name = settings.EMBEDDING_MODEL
            
            # Check if GPU should be used
            device = "cuda" if settings.USE_GPU else "cpu"
            
            self.embedding_model = SentenceTransformer(model_name, device=device)
            logger.info("Embedding model loaded", model=model_name, device=device)
            
        except ImportError:
            logger.warning("sentence-transformers not available, using fallback")
            self.embedding_model = None
    
    async def _load_recommendation_model(self) -> None:
        """Load recommendation ranking model."""
        model_path = Path(settings.MODEL_PATH) / "recommendation_ranker.pkl"
        
        if model_path.exists():
            import joblib
            self.recommendation_model = joblib.load(model_path)
            logger.info("Recommendation model loaded", path=str(model_path))
        else:
            logger.info("No pre-trained recommendation model found, using rule-based")
    
    async def _load_skill_gap_model(self) -> None:
        """Load skill gap analysis model."""
        model_path = Path(settings.MODEL_PATH) / "skill_gap_analyzer.pkl"
        
        if model_path.exists():
            import joblib
            self.skill_gap_model = joblib.load(model_path)
            logger.info("Skill gap model loaded", path=str(model_path))
        else:
            logger.info("No pre-trained skill gap model found, using rule-based")
    
    async def _load_trend_model(self) -> None:
        """Load trend forecasting model."""
        model_path = Path(settings.MODEL_PATH) / "trend_forecaster.pkl"
        
        if model_path.exists():
            import joblib
            self.trend_model = joblib.load(model_path)
            logger.info("Trend model loaded", path=str(model_path))
        else:
            logger.info("No pre-trained trend model found, using rule-based")
    
    async def cleanup(self) -> None:
        """Cleanup resources."""
        self.recommendation_model = None
        self.skill_gap_model = None
        self.trend_model = None
        self.embedding_model = None
        logger.info("ML models cleaned up")
    
    @property
    def is_initialized(self) -> bool:
        """Check if models are initialized."""
        return self._initialized
    
    def get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for a text string."""
        if self.embedding_model is None:
            # Return random embedding as fallback
            return np.random.rand(settings.EMBEDDING_DIMENSION)
        
        return self.embedding_model.encode(text, convert_to_numpy=True)
    
    def get_embeddings(self, texts: List[str]) -> np.ndarray:
        """Get embeddings for multiple texts."""
        if self.embedding_model is None:
            return np.random.rand(len(texts), settings.EMBEDDING_DIMENSION)
        
        return self.embedding_model.encode(texts, convert_to_numpy=True)
    
    async def generate_recommendations(
        self,
        user_context: UserContext,
        skill_gaps: List[Dict[str, Any]],
        market_signals: List[MarketSignal],
        max_recommendations: int = 10,
    ) -> List[RecommendationItem]:
        """Generate personalized recommendations."""
        
        recommendations = []
        
        # Build user profile features
        user_features = self._extract_user_features(user_context)
        
        # Get candidate content (would normally come from content catalog)
        candidates = await self._get_candidate_content(user_context, skill_gaps)
        
        # Score each candidate
        for candidate in candidates[:max_recommendations * 2]:  # Get more than needed for filtering
            scores = await self._score_candidate(
                candidate, 
                user_features, 
                skill_gaps,
                market_signals
            )
            
            if scores["overall"] >= settings.MIN_CONFIDENCE_THRESHOLD:
                recommendation = self._create_recommendation(candidate, scores)
                recommendations.append(recommendation)
        
        # Sort by overall score and limit
        recommendations.sort(key=lambda x: x.overall_score, reverse=True)
        return recommendations[:max_recommendations]
    
    def _extract_user_features(self, user_context: UserContext) -> Dict[str, Any]:
        """Extract features from user context."""
        skill_levels = {
            skill.skill_id: skill.current_level 
            for skill in user_context.skills
        }
        
        return {
            "skill_levels": skill_levels,
            "career_goals": user_context.career_goals,
            "target_role": user_context.target_role,
            "experience_level": user_context.experience_level,
            "learning_style": user_context.preferred_learning_style,
            "weekly_hours": user_context.weekly_learning_hours,
        }
    
    async def _get_candidate_content(
        self, 
        user_context: UserContext,
        skill_gaps: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Get candidate content for recommendations."""
        # In production, this would query a content catalog
        # For now, generate synthetic candidates based on skill gaps
        
        candidates = []
        gap_skills = [gap.get("skill_name", "General") for gap in skill_gaps[:5]]
        
        content_templates = [
            {"type": ContentType.COURSE, "prefix": "Complete", "suffix": "Masterclass", "duration": 480},
            {"type": ContentType.VIDEO, "prefix": "Introduction to", "suffix": "", "duration": 30},
            {"type": ContentType.PROJECT, "prefix": "Hands-on", "suffix": "Project", "duration": 120},
            {"type": ContentType.TUTORIAL, "prefix": "Step-by-step", "suffix": "Guide", "duration": 60},
            {"type": ContentType.ASSESSMENT, "prefix": "", "suffix": "Skills Assessment", "duration": 45},
        ]
        
        for skill in gap_skills:
            for template in content_templates:
                title = f"{template['prefix']} {skill} {template['suffix']}".strip()
                candidates.append({
                    "content_id": f"content-{len(candidates) + 1}",
                    "content_type": template["type"],
                    "title": title,
                    "description": f"Learn {skill} with this comprehensive {template['type'].value.lower()}",
                    "provider": "SkillPod",
                    "skill_ids": [skill],
                    "duration_minutes": template["duration"],
                    "difficulty": "INTERMEDIATE",
                })
        
        return candidates
    
    async def _score_candidate(
        self,
        candidate: Dict[str, Any],
        user_features: Dict[str, Any],
        skill_gaps: List[Dict[str, Any]],
        market_signals: List[MarketSignal],
    ) -> Dict[str, float]:
        """Score a candidate recommendation."""
        
        # Relevance score - based on skill gap match
        relevance = 0.5  # Base relevance
        candidate_skills = candidate.get("skill_ids", [])
        
        for gap in skill_gaps:
            if gap.get("skill_name") in candidate_skills or gap.get("skill_id") in candidate_skills:
                gap_score = gap.get("gap_score", 50) / 100
                relevance = max(relevance, gap_score)
        
        # Urgency score - based on market signals
        urgency = 0.3  # Base urgency
        for signal in market_signals[-5:]:  # Recent signals
            if any(skill in signal.skill_ids for skill in candidate_skills):
                if signal.signal_type == "JOB_REJECTION":
                    urgency = max(urgency, 0.9)
                elif signal.signal_type == "JOB_APPLICATION":
                    urgency = max(urgency, 0.7)
        
        # Impact score - based on career goals alignment
        impact = 0.4
        if user_features.get("career_goals"):
            # Simple keyword matching for demo
            title_lower = candidate.get("title", "").lower()
            for goal in user_features["career_goals"]:
                if goal.lower() in title_lower:
                    impact = 0.8
                    break
        
        # Confidence score - model confidence or rule certainty
        confidence = 0.7 if self.recommendation_model else 0.5
        
        # Overall weighted score
        overall = (
            relevance * 0.35 +
            urgency * 0.25 +
            impact * 0.25 +
            confidence * 0.15
        )
        
        return {
            "relevance": relevance,
            "urgency": urgency,
            "impact": impact,
            "confidence": confidence,
            "overall": overall,
        }
    
    def _create_recommendation(
        self, 
        candidate: Dict[str, Any],
        scores: Dict[str, float]
    ) -> RecommendationItem:
        """Create a recommendation item from candidate and scores."""
        
        # Determine recommendation type based on scores
        if scores["urgency"] > 0.7:
            rec_type = RecommendationType.SKILL_GAP_FILL
        elif scores["impact"] > 0.6:
            rec_type = RecommendationType.CAREER_ADVANCEMENT
        else:
            rec_type = RecommendationType.TRENDING_SKILL
        
        return RecommendationItem(
            content_id=candidate["content_id"],
            content_type=candidate["content_type"],
            title=candidate["title"],
            description=candidate.get("description"),
            provider=candidate.get("provider"),
            url=candidate.get("url"),
            relevance_score=round(scores["relevance"], 3),
            urgency_score=round(scores["urgency"], 3),
            impact_score=round(scores["impact"], 3),
            confidence_score=round(scores["confidence"], 3),
            overall_score=round(scores["overall"], 3),
            recommendation_type=rec_type,
            target_skill_ids=candidate.get("skill_ids", []),
            prerequisite_ids=[],
            estimated_duration_minutes=candidate.get("duration_minutes"),
            reasoning=self._generate_reasoning(candidate, scores),
            factors=[
                {"name": "Skill Gap Match", "value": scores["relevance"]},
                {"name": "Market Urgency", "value": scores["urgency"]},
                {"name": "Career Impact", "value": scores["impact"]},
            ],
        )
    
    def _generate_reasoning(
        self, 
        candidate: Dict[str, Any], 
        scores: Dict[str, float]
    ) -> str:
        """Generate human-readable reasoning for recommendation."""
        reasons = []
        
        if scores["relevance"] > 0.6:
            reasons.append("addresses a key skill gap")
        if scores["urgency"] > 0.6:
            reasons.append("is relevant to your recent job applications")
        if scores["impact"] > 0.6:
            reasons.append("aligns with your career goals")
        
        if reasons:
            return f"Recommended because it {', '.join(reasons)}."
        return "Recommended based on your learning profile."
    
    async def analyze_skill_gaps(
        self,
        user_context: UserContext,
        target_skills: List[Dict[str, Any]],
        market_signals: List[MarketSignal],
    ) -> List[SkillGapItem]:
        """Analyze skill gaps for a user."""
        
        gaps = []
        user_skills = {s.skill_id: s.current_level for s in user_context.skills}
        
        for target in target_skills:
            skill_id = target.get("skill_id", "")
            skill_name = target.get("skill_name", "Unknown")
            required_level = target.get("required_level", 70)
            current_level = user_skills.get(skill_id, 0)
            
            if current_level < required_level:
                gap_score = required_level - current_level
                
                # Determine priority based on gap and market signals
                priority = self._calculate_gap_priority(
                    gap_score, skill_id, market_signals
                )
                
                gap_type = "MISSING" if current_level == 0 else "LEVEL_MISMATCH"
                
                gaps.append(SkillGapItem(
                    skill_id=skill_id,
                    skill_name=skill_name,
                    gap_type=gap_type,
                    priority=priority,
                    current_level=current_level,
                    required_level=required_level,
                    gap_score=float(gap_score),
                    market_demand_score=self._estimate_market_demand(skill_id),
                    career_impact=self._assess_career_impact(skill_name, gap_score),
                    recommended_actions=self._get_recommended_actions(gap_type, gap_score),
                ))
        
        # Sort by priority and gap score
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        gaps.sort(key=lambda g: (priority_order[g.priority], -g.gap_score))
        
        return gaps
    
    def _calculate_gap_priority(
        self,
        gap_score: float,
        skill_id: str,
        market_signals: List[MarketSignal],
    ) -> GapPriority:
        """Calculate priority for a skill gap."""
        
        # Check if skill appears in recent rejections
        rejection_mentions = sum(
            1 for s in market_signals 
            if s.signal_type == "JOB_REJECTION" and skill_id in s.skill_ids
        )
        
        if rejection_mentions >= 2 or gap_score >= 70:
            return GapPriority.CRITICAL
        elif rejection_mentions >= 1 or gap_score >= 50:
            return GapPriority.HIGH
        elif gap_score >= 30:
            return GapPriority.MEDIUM
        return GapPriority.LOW
    
    def _estimate_market_demand(self, skill_id: str) -> float:
        """Estimate market demand for a skill."""
        # In production, this would query actual market data
        return np.random.uniform(60, 95)
    
    def _assess_career_impact(self, skill_name: str, gap_score: float) -> str:
        """Assess career impact of filling the gap."""
        if gap_score >= 70:
            return f"Mastering {skill_name} could significantly improve job prospects"
        elif gap_score >= 40:
            return f"Improving {skill_name} skills would enhance competitiveness"
        return f"Building {skill_name} proficiency is recommended for career growth"
    
    def _get_recommended_actions(self, gap_type: str, gap_score: float) -> List[str]:
        """Get recommended actions for a skill gap."""
        actions = []
        
        if gap_type == "MISSING":
            actions.append("Start with beginner-level courses")
            actions.append("Complete hands-on projects to build practical experience")
        else:
            actions.append("Focus on advanced topics to reach target level")
            
        if gap_score >= 50:
            actions.append("Consider intensive bootcamp or certification program")
            actions.append("Seek mentorship from experienced practitioners")
        
        return actions
    
    async def forecast_trend(
        self,
        skill_id: str,
        periods_ahead: int = 12,
    ) -> TrendForecast:
        """Forecast skill demand trend."""
        
        # Generate synthetic forecast data for demo
        current_demand = np.random.uniform(50, 90)
        
        # Simple linear trend with noise
        trend_slope = np.random.uniform(-0.02, 0.05)  # Monthly change rate
        forecasts = []
        
        for i in range(1, periods_ahead + 1):
            predicted = current_demand * (1 + trend_slope * i)
            predicted = max(0, min(100, predicted))  # Clamp to 0-100
            
            forecasts.append({
                "period": i,
                "predicted_demand": round(predicted, 2),
                "lower_bound": round(predicted * 0.85, 2),
                "upper_bound": round(min(100, predicted * 1.15), 2),
            })
        
        # Determine trend direction
        final_demand = forecasts[-1]["predicted_demand"]
        if final_demand > current_demand * 1.1:
            direction = TrendDirection.RISING
        elif final_demand < current_demand * 0.9:
            direction = TrendDirection.DECLINING
        else:
            direction = TrendDirection.STABLE
        
        return TrendForecast(
            skill_id=skill_id,
            current_demand_score=round(current_demand, 2),
            forecasts=forecasts,
            trend_direction=direction,
            confidence=0.7 if self.trend_model else 0.5,
            factors=[
                "Job posting volume",
                "Application competition",
                "Rate trends",
                "Related skill growth",
            ],
        )
