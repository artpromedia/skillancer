"""
Configuration settings for the ML Recommendation Service.
"""

from typing import List
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings."""
    
    # Service info
    SERVICE_NAME: str = "ml-recommendation-svc"
    VERSION: str = "0.1.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8080
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://skillancer:skillancer@localhost:5432/skillancer_dev"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    CACHE_TTL_SECONDS: int = 3600
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    
    # ML Models
    MODEL_PATH: str = "./models"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384
    
    # Recommendation settings
    DEFAULT_RECOMMENDATIONS_LIMIT: int = 10
    MAX_RECOMMENDATIONS_LIMIT: int = 50
    MIN_CONFIDENCE_THRESHOLD: float = 0.3
    
    # ML weights
    ML_SCORE_WEIGHT: float = 0.6
    RULE_SCORE_WEIGHT: float = 0.4
    
    # Feature flags
    USE_GPU: bool = False
    ENABLE_CACHING: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
