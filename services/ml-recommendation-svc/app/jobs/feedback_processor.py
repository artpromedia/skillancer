"""
Feedback Processor
Processes user feedback on AI suggestions for model improvement
Sprint M7: AI Work Assistant
"""

from typing import Optional, List, Dict
from pydantic import BaseModel
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict
import structlog

logger = structlog.get_logger()


# =============================================================================
# TYPES
# =============================================================================

class FeedbackType(str, Enum):
    HELPFUL = "helpful"
    NOT_HELPFUL = "not_helpful"
    USED = "used"
    MODIFIED = "modified"
    IGNORED = "ignored"


class SuggestionType(str, Enum):
    PROPOSAL_OPENING = "proposal_opening"
    PROPOSAL_BODY = "proposal_body"
    PROPOSAL_CLOSING = "proposal_closing"
    PROPOSAL_IMPROVEMENT = "proposal_improvement"
    RATE_RECOMMENDATION = "rate_recommendation"
    CAREER_RECOMMENDATION = "career_recommendation"
    CODE_SUGGESTION = "code_suggestion"
    WRITING_SUGGESTION = "writing_suggestion"


class UserFeedback(BaseModel):
    """User feedback record"""
    feedback_id: str
    suggestion_id: str
    user_id: str
    job_id: Optional[str] = None
    feedback_type: FeedbackType
    suggestion_type: SuggestionType
    suggestion_content: Optional[str] = None
    user_modification: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime


class FeedbackAggregation(BaseModel):
    """Aggregated feedback stats"""
    suggestion_type: SuggestionType
    total_feedback: int
    helpful_rate: float
    usage_rate: float
    modification_rate: float
    top_issues: List[str]
    improvement_areas: List[str]


class FeedbackInsight(BaseModel):
    """Insight from feedback analysis"""
    insight_type: str
    title: str
    description: str
    affected_suggestions: List[str]
    recommended_action: str
    priority: str
    data_points: int


# =============================================================================
# FEEDBACK PROCESSOR
# =============================================================================

class FeedbackProcessor:
    """
    Processes user feedback on AI suggestions.
    
    Responsibilities:
    - Store and categorize feedback
    - Aggregate feedback by type
    - Generate insights for model improvement
    - Feed into retraining pipeline
    """
    
    def __init__(self, db, metrics, alert_service):
        self.db = db
        self.metrics = metrics
        self.alert_service = alert_service
        
        # Thresholds for alerts
        self.low_helpful_rate_threshold = 0.5
        self.min_samples_for_insight = 50
    
    # -------------------------------------------------------------------------
    # FEEDBACK COLLECTION
    # -------------------------------------------------------------------------
    
    async def record_feedback(
        self,
        suggestion_id: str,
        user_id: str,
        feedback_type: str,
        suggestion_type: str,
        job_id: Optional[str] = None,
        suggestion_content: Optional[str] = None,
        user_modification: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> UserFeedback:
        """
        Record user feedback on an AI suggestion.
        
        Called when user interacts with suggestion:
        - Accepts (used)
        - Modifies (modified)
        - Dismisses (ignored)
        - Rates (helpful/not_helpful)
        """
        feedback = UserFeedback(
            feedback_id=f"fb_{suggestion_id}_{datetime.utcnow().timestamp()}",
            suggestion_id=suggestion_id,
            user_id=user_id,
            job_id=job_id,
            feedback_type=FeedbackType(feedback_type),
            suggestion_type=SuggestionType(suggestion_type),
            suggestion_content=suggestion_content,
            user_modification=user_modification,
            comment=comment,
            created_at=datetime.utcnow(),
        )
        
        logger.info(
            "Recording feedback",
            suggestion_id=suggestion_id,
            feedback_type=feedback_type,
            suggestion_type=suggestion_type,
        )
        
        # Store feedback
        await self.db.insert(
            "ai_feedback",
            feedback.model_dump(),
        )
        
        # Track metrics
        self.metrics.increment(
            "ai_suggestion_feedback",
            tags={
                "feedback_type": feedback_type,
                "suggestion_type": suggestion_type,
            },
        )
        
        # Check for concerning patterns
        await self._check_feedback_patterns(feedback)
        
        return feedback
    
    async def _check_feedback_patterns(self, feedback: UserFeedback):
        """Check for patterns that need attention."""
        # Get recent feedback for this suggestion type
        recent_feedback = await self.db.query(
            "ai_feedback",
            {
                "suggestion_type": feedback.suggestion_type.value,
                "created_at": {
                    "$gte": datetime.utcnow() - timedelta(hours=24),
                },
            },
        )
        
        if len(recent_feedback) < 10:
            return
        
        # Calculate helpful rate
        helpful_count = sum(
            1 for f in recent_feedback
            if f["feedback_type"] in ["helpful", "used"]
        )
        helpful_rate = helpful_count / len(recent_feedback)
        
        # Alert if rate is concerning
        if helpful_rate < self.low_helpful_rate_threshold:
            await self.alert_service.send_alert(
                "low_suggestion_quality",
                severity="medium",
                details={
                    "suggestion_type": feedback.suggestion_type.value,
                    "helpful_rate": helpful_rate,
                    "sample_size": len(recent_feedback),
                },
            )
    
    # -------------------------------------------------------------------------
    # FEEDBACK AGGREGATION
    # -------------------------------------------------------------------------
    
    async def aggregate_feedback(
        self,
        suggestion_type: Optional[SuggestionType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[FeedbackAggregation]:
        """
        Aggregate feedback statistics.
        
        Used for:
        - Dashboard reporting
        - Model improvement prioritization
        - A/B test analysis
        """
        if start_date is None:
            start_date = datetime.utcnow() - timedelta(days=30)
        if end_date is None:
            end_date = datetime.utcnow()
        
        query = {
            "created_at": {
                "$gte": start_date,
                "$lt": end_date,
            },
        }
        
        if suggestion_type:
            query["suggestion_type"] = suggestion_type.value
        
        feedback = await self.db.query("ai_feedback", query)
        
        # Group by suggestion type
        by_type = defaultdict(list)
        for f in feedback:
            by_type[f["suggestion_type"]].append(f)
        
        aggregations = []
        for stype, items in by_type.items():
            total = len(items)
            
            helpful = sum(1 for f in items if f["feedback_type"] == "helpful")
            used = sum(1 for f in items if f["feedback_type"] in ["used", "modified"])
            modified = sum(1 for f in items if f["feedback_type"] == "modified")
            
            # Extract common issues from comments
            issues = self._extract_issues(items)
            improvements = self._suggest_improvements(items)
            
            aggregations.append(FeedbackAggregation(
                suggestion_type=SuggestionType(stype),
                total_feedback=total,
                helpful_rate=helpful / total if total > 0 else 0,
                usage_rate=used / total if total > 0 else 0,
                modification_rate=modified / total if total > 0 else 0,
                top_issues=issues[:5],
                improvement_areas=improvements[:5],
            ))
        
        return aggregations
    
    def _extract_issues(self, feedback_items: List[dict]) -> List[str]:
        """Extract common issues from feedback comments."""
        issues = []
        
        # Look for patterns in negative feedback
        negative = [
            f for f in feedback_items
            if f["feedback_type"] in ["not_helpful", "ignored"]
        ]
        
        # Analyze comments (simplified - would use NLP in production)
        keywords = defaultdict(int)
        for f in negative:
            if f.get("comment"):
                for word in ["irrelevant", "wrong", "generic", "long", "short", "confusing"]:
                    if word in f["comment"].lower():
                        keywords[word] += 1
        
        for word, count in sorted(keywords.items(), key=lambda x: -x[1]):
            if count >= 3:
                issues.append(f"Suggestions perceived as {word} ({count} mentions)")
        
        return issues
    
    def _suggest_improvements(self, feedback_items: List[dict]) -> List[str]:
        """Suggest improvements based on feedback patterns."""
        improvements = []
        
        # Analyze modifications to understand what users change
        modifications = [
            f for f in feedback_items
            if f["feedback_type"] == "modified" and f.get("user_modification")
        ]
        
        if len(modifications) > 10:
            improvements.append("High modification rate - analyze user edits for patterns")
        
        # Check usage by context
        # (Simplified - would do more sophisticated analysis in production)
        
        return improvements
    
    # -------------------------------------------------------------------------
    # INSIGHT GENERATION
    # -------------------------------------------------------------------------
    
    async def generate_insights(
        self,
        lookback_days: int = 30,
    ) -> List[FeedbackInsight]:
        """
        Generate actionable insights from feedback.
        
        Used for:
        - Model improvement planning
        - Feature prioritization
        - Quality monitoring
        """
        logger.info(
            "Generating feedback insights",
            lookback_days=lookback_days,
        )
        
        insights = []
        start_date = datetime.utcnow() - timedelta(days=lookback_days)
        
        # Get aggregations
        aggregations = await self.aggregate_feedback(start_date=start_date)
        
        for agg in aggregations:
            if agg.total_feedback < self.min_samples_for_insight:
                continue
            
            # Low helpful rate insight
            if agg.helpful_rate < 0.6:
                insights.append(FeedbackInsight(
                    insight_type="quality_issue",
                    title=f"Low quality for {agg.suggestion_type.value}",
                    description=f"Only {agg.helpful_rate:.0%} of suggestions rated helpful",
                    affected_suggestions=[agg.suggestion_type.value],
                    recommended_action="Review and retrain model for this suggestion type",
                    priority="high" if agg.helpful_rate < 0.4 else "medium",
                    data_points=agg.total_feedback,
                ))
            
            # High modification rate insight
            if agg.modification_rate > 0.5:
                insights.append(FeedbackInsight(
                    insight_type="personalization_gap",
                    title=f"High modification rate for {agg.suggestion_type.value}",
                    description=f"{agg.modification_rate:.0%} of used suggestions are modified",
                    affected_suggestions=[agg.suggestion_type.value],
                    recommended_action="Improve personalization in suggestion generation",
                    priority="medium",
                    data_points=agg.total_feedback,
                ))
            
            # Low usage rate insight
            if agg.usage_rate < 0.3:
                insights.append(FeedbackInsight(
                    insight_type="relevance_issue",
                    title=f"Low usage rate for {agg.suggestion_type.value}",
                    description=f"Only {agg.usage_rate:.0%} of suggestions are used",
                    affected_suggestions=[agg.suggestion_type.value],
                    recommended_action="Improve relevance matching and timing",
                    priority="medium",
                    data_points=agg.total_feedback,
                ))
        
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        insights.sort(key=lambda x: priority_order.get(x.priority, 3))
        
        return insights
    
    # -------------------------------------------------------------------------
    # TRAINING DATA EXPORT
    # -------------------------------------------------------------------------
    
    async def export_for_training(
        self,
        suggestion_type: SuggestionType,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[dict]:
        """
        Export feedback data for model training.
        
        Returns structured data suitable for fine-tuning:
        - Original suggestion
        - User modification (if any)
        - Outcome label
        """
        if start_date is None:
            start_date = datetime.utcnow() - timedelta(days=90)
        if end_date is None:
            end_date = datetime.utcnow()
        
        feedback = await self.db.query(
            "ai_feedback",
            {
                "suggestion_type": suggestion_type.value,
                "created_at": {"$gte": start_date, "$lt": end_date},
            },
        )
        
        training_data = []
        for f in feedback:
            if not f.get("suggestion_content"):
                continue
            
            # Create training example
            example = {
                "input": f.get("suggestion_content"),
                "context": f.get("context", {}),
                "label": self._feedback_to_label(f["feedback_type"]),
                "weight": self._calculate_weight(f),
            }
            
            # If modified, include the improvement
            if f.get("user_modification"):
                example["improved_version"] = f["user_modification"]
            
            training_data.append(example)
        
        return training_data
    
    def _feedback_to_label(self, feedback_type: str) -> int:
        """Convert feedback type to training label."""
        positive = ["helpful", "used"]
        return 1 if feedback_type in positive else 0
    
    def _calculate_weight(self, feedback: dict) -> float:
        """Calculate sample weight for training."""
        # Higher weight for explicit feedback
        if feedback["feedback_type"] in ["helpful", "not_helpful"]:
            return 1.5
        # Modifications are valuable
        if feedback.get("user_modification"):
            return 1.2
        return 1.0
    
    # -------------------------------------------------------------------------
    # REPORTING
    # -------------------------------------------------------------------------
    
    async def get_feedback_summary(
        self,
        period_days: int = 7,
    ) -> dict:
        """Get summary report of feedback."""
        start_date = datetime.utcnow() - timedelta(days=period_days)
        
        feedback = await self.db.query(
            "ai_feedback",
            {"created_at": {"$gte": start_date}},
        )
        
        total = len(feedback)
        by_type = defaultdict(int)
        by_suggestion = defaultdict(int)
        
        for f in feedback:
            by_type[f["feedback_type"]] += 1
            by_suggestion[f["suggestion_type"]] += 1
        
        return {
            "period_days": period_days,
            "total_feedback": total,
            "by_feedback_type": dict(by_type),
            "by_suggestion_type": dict(by_suggestion),
            "helpful_rate": by_type.get("helpful", 0) / total if total > 0 else 0,
            "usage_rate": (
                (by_type.get("used", 0) + by_type.get("modified", 0)) / total
                if total > 0 else 0
            ),
        }
