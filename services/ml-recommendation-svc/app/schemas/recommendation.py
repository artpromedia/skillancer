"""
Pydantic schemas for API requests and responses.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


# =============================================================================
# ENUMS
# =============================================================================

class RecommendationType(str, Enum):
    SKILL_GAP_FILL = "SKILL_GAP_FILL"
    CAREER_ADVANCEMENT = "CAREER_ADVANCEMENT"
    MARKET_DEMAND = "MARKET_DEMAND"
    TRENDING_SKILL = "TRENDING_SKILL"
    CERTIFICATION = "CERTIFICATION"
    REFRESH_KNOWLEDGE = "REFRESH_KNOWLEDGE"
    COMPETITIVE_EDGE = "COMPETITIVE_EDGE"
    PREREQUISITE = "PREREQUISITE"
    QUICK_WIN = "QUICK_WIN"
    DEEP_DIVE = "DEEP_DIVE"


class ContentType(str, Enum):
    VIDEO = "VIDEO"
    ARTICLE = "ARTICLE"
    COURSE = "COURSE"
    TUTORIAL = "TUTORIAL"
    PROJECT = "PROJECT"
    QUIZ = "QUIZ"
    ASSESSMENT = "ASSESSMENT"
    WORKSHOP = "WORKSHOP"
    MENTORING = "MENTORING"
    CERTIFICATION = "CERTIFICATION"


class TrendDirection(str, Enum):
    RISING = "RISING"
    STABLE = "STABLE"
    DECLINING = "DECLINING"


class GapPriority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


# =============================================================================
# REQUEST SCHEMAS
# =============================================================================

class SkillProfile(BaseModel):
    """User's skill profile for recommendation generation."""
    skill_id: str
    skill_name: str
    current_level: int = Field(ge=0, le=100)
    years_experience: Optional[float] = None


class UserContext(BaseModel):
    """User context for personalized recommendations."""
    user_id: str
    tenant_id: str
    skills: List[SkillProfile] = []
    career_goals: List[str] = []
    target_role: Optional[str] = None
    experience_level: Optional[str] = None
    preferred_learning_style: Optional[str] = None
    weekly_learning_hours: Optional[int] = Field(default=10, ge=1, le=80)


class MarketSignal(BaseModel):
    """Market activity signal for recommendation context."""
    signal_type: str
    skill_ids: List[str] = []
    job_id: Optional[str] = None
    outcome: Optional[str] = None
    match_score: Optional[float] = None
    timestamp: datetime


class GenerateRecommendationsRequest(BaseModel):
    """Request to generate recommendations."""
    user_context: UserContext
    recent_signals: List[MarketSignal] = []
    skill_gaps: List[Dict[str, Any]] = []
    max_recommendations: int = Field(default=10, ge=1, le=50)
    include_explanations: bool = True
    filter_content_types: Optional[List[ContentType]] = None
    min_confidence: float = Field(default=0.3, ge=0.0, le=1.0)


class AnalyzeSkillGapsRequest(BaseModel):
    """Request to analyze skill gaps."""
    user_context: UserContext
    target_skills: List[Dict[str, Any]] = []
    market_signals: List[MarketSignal] = []
    include_market_context: bool = True


class ForecastTrendRequest(BaseModel):
    """Request for skill trend forecast."""
    skill_id: str
    periods_ahead: int = Field(default=12, ge=1, le=52)
    include_confidence_intervals: bool = True


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class RecommendationItem(BaseModel):
    """A single recommendation item."""
    content_id: str
    content_type: ContentType
    title: str
    description: Optional[str] = None
    provider: Optional[str] = None
    url: Optional[str] = None
    
    # Scoring
    relevance_score: float = Field(ge=0.0, le=1.0)
    urgency_score: float = Field(ge=0.0, le=1.0)
    impact_score: float = Field(ge=0.0, le=1.0)
    confidence_score: float = Field(ge=0.0, le=1.0)
    overall_score: float = Field(ge=0.0, le=1.0)
    
    # Context
    recommendation_type: RecommendationType
    target_skill_ids: List[str] = []
    prerequisite_ids: List[str] = []
    estimated_duration_minutes: Optional[int] = None
    
    # Explanation
    reasoning: Optional[str] = None
    factors: List[Dict[str, Any]] = []


class GenerateRecommendationsResponse(BaseModel):
    """Response with generated recommendations."""
    recommendations: List[RecommendationItem]
    generation_method: str
    model_version: str
    processing_time_ms: int
    user_id: str


class SkillGapItem(BaseModel):
    """Analyzed skill gap."""
    skill_id: str
    skill_name: str
    gap_type: str
    priority: GapPriority
    current_level: int
    required_level: int
    gap_score: float = Field(ge=0.0, le=100.0)
    market_demand_score: float = Field(ge=0.0, le=100.0)
    career_impact: Optional[str] = None
    recommended_actions: List[str] = []


class AnalyzeSkillGapsResponse(BaseModel):
    """Response with skill gap analysis."""
    skill_gaps: List[SkillGapItem]
    summary: Dict[str, Any]
    market_context: Optional[Dict[str, Any]] = None
    processing_time_ms: int


class TrendForecast(BaseModel):
    """Skill trend forecast."""
    skill_id: str
    skill_name: Optional[str] = None
    current_demand_score: float
    forecasts: List[Dict[str, Any]]
    trend_direction: TrendDirection
    confidence: float
    factors: List[str] = []


class ForecastTrendResponse(BaseModel):
    """Response with trend forecast."""
    forecast: TrendForecast
    model_version: str
    processing_time_ms: int


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    models_loaded: bool
    uptime_seconds: int
