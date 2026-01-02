"""
AI Configuration
Feature flags and settings for AI Work Assistant
Sprint M7: AI Work Assistant
"""

from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from enum import Enum
from functools import lru_cache


# =============================================================================
# ENUMS
# =============================================================================

class AIProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"
    HYBRID = "hybrid"


class FeatureFlag(str, Enum):
    PROPOSAL_AI = "proposal_ai_enabled"
    RATE_OPTIMIZER = "rate_optimizer_enabled"
    CAREER_COACH = "career_coach_enabled"
    SKILLPOD_ASSISTANT = "skillpod_assistant_enabled"
    CODE_REVIEW = "code_review_enabled"
    WRITING_ASSISTANT = "writing_assistant_enabled"


# =============================================================================
# MODEL SETTINGS
# =============================================================================

class ModelSettings(BaseModel):
    """Settings for a specific model"""
    model_id: str
    provider: AIProvider
    temperature: float = 0.7
    max_tokens: int = 2000
    fallback_model: Optional[str] = None
    timeout_seconds: int = 60


class ProposalAISettings(BaseModel):
    """Settings for Proposal AI"""
    enabled: bool = True
    generation_model: ModelSettings = Field(
        default_factory=lambda: ModelSettings(
            model_id="gpt-4o",
            provider=AIProvider.OPENAI,
            temperature=0.8,
            max_tokens=2000,
        )
    )
    scoring_model: ModelSettings = Field(
        default_factory=lambda: ModelSettings(
            model_id="gpt-4o",
            provider=AIProvider.OPENAI,
            temperature=0.3,
            max_tokens=1000,
        )
    )
    max_suggestions_per_request: int = 5
    cache_ttl_seconds: int = 3600


class RateOptimizerSettings(BaseModel):
    """Settings for Rate Optimizer"""
    enabled: bool = True
    model_version: str = "rate_optimizer_v1"
    prediction_model_path: str = "./models/rate_predictor.pkl"
    confidence_threshold: float = 0.7
    cache_ttl_seconds: int = 1800


class CareerCoachSettings(BaseModel):
    """Settings for Career Coach"""
    enabled: bool = True
    generation_model: ModelSettings = Field(
        default_factory=lambda: ModelSettings(
            model_id="gpt-4o",
            provider=AIProvider.OPENAI,
            temperature=0.6,
            max_tokens=2000,
        )
    )
    trajectory_model_version: str = "career_trajectory_v1"
    max_recommendations: int = 5
    goal_check_interval_hours: int = 24


class SkillPodAssistantSettings(BaseModel):
    """Settings for SkillPod Work Assistant"""
    enabled: bool = True
    code_review_model: ModelSettings = Field(
        default_factory=lambda: ModelSettings(
            model_id="local",
            provider=AIProvider.LOCAL,
            temperature=0.3,
            max_tokens=4000,
        )
    )
    writing_model: ModelSettings = Field(
        default_factory=lambda: ModelSettings(
            model_id="gpt-4o",
            provider=AIProvider.HYBRID,
            temperature=0.5,
            max_tokens=2000,
        )
    )
    general_model: ModelSettings = Field(
        default_factory=lambda: ModelSettings(
            model_id="gpt-4o",
            provider=AIProvider.OPENAI,
            temperature=0.7,
            max_tokens=2000,
        )
    )
    local_model_endpoint: str = "http://localhost:11434/api/generate"
    privacy_first: bool = True


# =============================================================================
# RATE LIMITING
# =============================================================================

class RateLimitSettings(BaseModel):
    """Rate limiting configuration"""
    requests_per_user_per_day: int = 1000
    requests_per_minute: int = 60
    tokens_per_user_per_day: int = 500000
    burst_limit: int = 10
    cooldown_seconds: int = 60


# =============================================================================
# A/B TESTING
# =============================================================================

class ABTestConfig(BaseModel):
    """A/B test configuration"""
    test_id: str
    feature: str
    variants: List[str]
    traffic_split: Dict[str, float]  # variant -> percentage
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    enabled: bool = True


# =============================================================================
# MAIN AI CONFIGURATION
# =============================================================================

class AISettings(BaseSettings):
    """Main AI configuration settings"""
    
    # API Keys
    OPENAI_API_KEY: str = ""
    OPENAI_ORG_ID: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # Default provider
    DEFAULT_PROVIDER: AIProvider = AIProvider.OPENAI
    
    # Feature-specific settings
    PROPOSAL_AI: ProposalAISettings = Field(default_factory=ProposalAISettings)
    RATE_OPTIMIZER: RateOptimizerSettings = Field(default_factory=RateOptimizerSettings)
    CAREER_COACH: CareerCoachSettings = Field(default_factory=CareerCoachSettings)
    SKILLPOD_ASSISTANT: SkillPodAssistantSettings = Field(default_factory=SkillPodAssistantSettings)
    
    # Rate limiting
    RATE_LIMITS: RateLimitSettings = Field(default_factory=RateLimitSettings)
    
    # Model endpoints
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    ANTHROPIC_BASE_URL: str = "https://api.anthropic.com/v1"
    LOCAL_MODEL_ENDPOINT: str = "http://localhost:11434"
    
    # Feature flags
    FEATURE_FLAGS: Dict[str, bool] = Field(default_factory=lambda: {
        FeatureFlag.PROPOSAL_AI.value: True,
        FeatureFlag.RATE_OPTIMIZER.value: True,
        FeatureFlag.CAREER_COACH.value: True,
        FeatureFlag.SKILLPOD_ASSISTANT.value: True,
        FeatureFlag.CODE_REVIEW.value: True,
        FeatureFlag.WRITING_ASSISTANT.value: True,
    })
    
    # A/B tests
    AB_TESTS: List[ABTestConfig] = Field(default_factory=list)
    
    # Caching
    CACHE_ENABLED: bool = True
    CACHE_DEFAULT_TTL: int = 3600
    
    # Logging
    LOG_REQUESTS: bool = True
    LOG_RESPONSES: bool = False  # Be careful with PII
    
    # Privacy
    ENABLE_PRIVACY_FILTER: bool = True
    STRICT_CONTAINMENT_MODE: bool = False
    
    class Config:
        env_prefix = "AI_"
        env_file = ".env"
        case_sensitive = True


# =============================================================================
# CONFIGURATION ACCESS
# =============================================================================

@lru_cache()
def get_ai_settings() -> AISettings:
    """Get cached AI settings instance."""
    return AISettings()


def is_feature_enabled(feature: FeatureFlag) -> bool:
    """Check if a feature is enabled."""
    settings = get_ai_settings()
    return settings.FEATURE_FLAGS.get(feature.value, False)


def get_model_settings(feature: str, model_type: str = "default") -> ModelSettings:
    """Get model settings for a feature."""
    settings = get_ai_settings()
    
    feature_settings_map = {
        "proposal_ai": settings.PROPOSAL_AI,
        "rate_optimizer": settings.RATE_OPTIMIZER,
        "career_coach": settings.CAREER_COACH,
        "skillpod_assistant": settings.SKILLPOD_ASSISTANT,
    }
    
    feature_settings = feature_settings_map.get(feature)
    if not feature_settings:
        raise ValueError(f"Unknown feature: {feature}")
    
    if hasattr(feature_settings, f"{model_type}_model"):
        return getattr(feature_settings, f"{model_type}_model")
    
    # Return default
    return ModelSettings(
        model_id="gpt-4o",
        provider=settings.DEFAULT_PROVIDER,
    )


def get_ab_test_variant(test_id: str, user_id: str) -> Optional[str]:
    """Get the A/B test variant for a user."""
    settings = get_ai_settings()
    
    test = next((t for t in settings.AB_TESTS if t.test_id == test_id), None)
    if not test or not test.enabled:
        return None
    
    # Deterministic assignment based on user_id hash
    import hashlib
    hash_val = int(hashlib.md5(f"{test_id}:{user_id}".encode()).hexdigest(), 16)
    bucket = (hash_val % 100) / 100
    
    cumulative = 0.0
    for variant, percentage in test.traffic_split.items():
        cumulative += percentage
        if bucket < cumulative:
            return variant
    
    return list(test.variants)[0]


# =============================================================================
# ENVIRONMENT-SPECIFIC OVERRIDES
# =============================================================================

def get_settings_for_environment(env: str = "production") -> AISettings:
    """Get settings with environment-specific overrides."""
    base_settings = get_ai_settings()
    
    if env == "development":
        # Use local models in development
        base_settings.DEFAULT_PROVIDER = AIProvider.LOCAL
        base_settings.SKILLPOD_ASSISTANT.privacy_first = True
        base_settings.LOG_RESPONSES = True
        
    elif env == "staging":
        # More permissive for testing
        base_settings.RATE_LIMITS.requests_per_user_per_day = 10000
        
    elif env == "production":
        # Strict settings
        base_settings.STRICT_CONTAINMENT_MODE = True
        base_settings.ENABLE_PRIVACY_FILTER = True
    
    return base_settings
