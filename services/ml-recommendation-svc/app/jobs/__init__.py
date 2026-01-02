"""
Jobs Module
Sprint M7: AI Work Assistant
"""

from .proposal_outcome_collector import ProposalOutcomeCollector
from .model_retraining import ModelRetrainingJob, ModelType
from .feedback_processor import FeedbackProcessor

__all__ = [
    "ProposalOutcomeCollector",
    "ModelRetrainingJob",
    "ModelType",
    "FeedbackProcessor",
]
