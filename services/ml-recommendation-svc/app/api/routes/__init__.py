"""
AI Routes Module
Sprint M7: AI Work Assistant
"""

from .proposal_routes import router as proposal_router
from .rate_routes import router as rate_router
from .career_routes import router as career_router

__all__ = [
    "proposal_router",
    "rate_router",
    "career_router",
]
