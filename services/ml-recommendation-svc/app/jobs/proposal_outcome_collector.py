"""
Proposal Outcome Collector
Collects proposal outcomes for model training
Sprint M7: AI Work Assistant
"""

from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import structlog
import asyncio

logger = structlog.get_logger()


# =============================================================================
# TYPES
# =============================================================================

class ProposalOutcome(BaseModel):
    """Proposal outcome data for training"""
    proposal_id: str
    job_id: str
    user_id: str
    job_post: dict
    proposal_content: str
    outcome: str  # won, lost, withdrawn
    time_to_decision: Optional[int] = None  # hours
    client_feedback: Optional[str] = None
    proposed_rate: float
    winning_rate: Optional[float] = None
    collected_at: datetime


class TrainingDataset(BaseModel):
    """Training dataset metadata"""
    dataset_id: str
    created_at: datetime
    num_samples: int
    outcome_distribution: dict
    date_range: dict
    version: str


# =============================================================================
# PROPOSAL OUTCOME COLLECTOR
# =============================================================================

class ProposalOutcomeCollector:
    """
    Collects proposal outcomes for model training.
    
    Triggered when proposal status changes to:
    - Accepted (won)
    - Rejected (lost)
    - Withdrawn
    
    Stores structured data for retraining.
    """
    
    def __init__(self, db, storage, metrics):
        self.db = db
        self.storage = storage
        self.metrics = metrics
        self.batch_size = 100
        self.retraining_threshold = 1000  # New samples before retraining
    
    # -------------------------------------------------------------------------
    # OUTCOME COLLECTION
    # -------------------------------------------------------------------------
    
    async def on_proposal_status_change(
        self,
        proposal_id: str,
        old_status: str,
        new_status: str,
    ):
        """
        Handle proposal status change event.
        
        Collects outcome data when proposal reaches terminal state.
        """
        terminal_statuses = {"accepted", "rejected", "withdrawn"}
        
        if new_status not in terminal_statuses:
            return
        
        logger.info(
            "Collecting proposal outcome",
            proposal_id=proposal_id,
            status=new_status,
        )
        
        try:
            # Fetch proposal and job details
            proposal_data = await self._fetch_proposal_data(proposal_id)
            job_data = await self._fetch_job_data(proposal_data["job_id"])
            
            # Map status to outcome
            outcome_map = {
                "accepted": "won",
                "rejected": "lost",
                "withdrawn": "withdrawn",
            }
            
            # Create outcome record
            outcome = ProposalOutcome(
                proposal_id=proposal_id,
                job_id=proposal_data["job_id"],
                user_id=proposal_data["user_id"],
                job_post={
                    "title": job_data["title"],
                    "description": job_data["description"],
                    "skills": job_data.get("skills", []),
                    "budget_min": job_data.get("budget_min"),
                    "budget_max": job_data.get("budget_max"),
                    "client_id": job_data["client_id"],
                },
                proposal_content=proposal_data["content"],
                outcome=outcome_map[new_status],
                time_to_decision=self._calculate_time_to_decision(proposal_data),
                client_feedback=proposal_data.get("client_feedback"),
                proposed_rate=proposal_data["rate"],
                winning_rate=await self._get_winning_rate(
                    proposal_data["job_id"],
                    proposal_id,
                ) if new_status == "rejected" else None,
                collected_at=datetime.utcnow(),
            )
            
            # Store outcome
            await self._store_outcome(outcome)
            
            # Check if retraining threshold met
            await self._check_retraining_trigger()
            
            # Track metrics
            self.metrics.increment(
                "proposal_outcomes_collected",
                tags={"outcome": outcome.outcome},
            )
            
        except Exception as e:
            logger.error(
                "Failed to collect proposal outcome",
                proposal_id=proposal_id,
                error=str(e),
            )
            self.metrics.increment(
                "proposal_outcome_collection_errors",
                tags={"error_type": type(e).__name__},
            )
    
    async def _fetch_proposal_data(self, proposal_id: str) -> dict:
        """Fetch proposal details from database."""
        # In production: Query database
        return {
            "job_id": "job_123",
            "user_id": "user_456",
            "content": "Sample proposal content...",
            "rate": 50.0,
            "created_at": datetime.utcnow(),
        }
    
    async def _fetch_job_data(self, job_id: str) -> dict:
        """Fetch job post details from database."""
        # In production: Query database
        return {
            "title": "Sample Job",
            "description": "Job description...",
            "skills": ["python", "fastapi"],
            "client_id": "client_789",
        }
    
    def _calculate_time_to_decision(self, proposal_data: dict) -> int:
        """Calculate hours from proposal submission to decision."""
        created_at = proposal_data.get("created_at")
        if not created_at:
            return 0
        delta = datetime.utcnow() - created_at
        return int(delta.total_seconds() / 3600)
    
    async def _get_winning_rate(
        self,
        job_id: str,
        losing_proposal_id: str,
    ) -> Optional[float]:
        """Get the winning proposal's rate for comparison."""
        # In production: Query for accepted proposal
        return None
    
    async def _store_outcome(self, outcome: ProposalOutcome):
        """Store outcome in training dataset."""
        logger.debug(
            "Storing proposal outcome",
            proposal_id=outcome.proposal_id,
            outcome=outcome.outcome,
        )
        
        # Store in database
        await self.db.insert(
            "proposal_training_data",
            outcome.model_dump(),
        )
        
        # Also append to parquet file for batch training
        await self.storage.append_to_dataset(
            "proposal_outcomes",
            outcome.model_dump(),
        )
    
    async def _check_retraining_trigger(self):
        """Check if we have enough new data to trigger retraining."""
        new_samples_count = await self.db.count(
            "proposal_training_data",
            {"processed": False},
        )
        
        if new_samples_count >= self.retraining_threshold:
            logger.info(
                "Retraining threshold reached",
                new_samples=new_samples_count,
                threshold=self.retraining_threshold,
            )
            # Queue retraining job
            await self._queue_retraining()
    
    async def _queue_retraining(self):
        """Queue model retraining job."""
        # In production: Publish to job queue
        pass
    
    # -------------------------------------------------------------------------
    # BATCH COLLECTION
    # -------------------------------------------------------------------------
    
    async def collect_batch(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> TrainingDataset:
        """
        Collect outcomes in batch for a date range.
        
        Used for initial dataset creation or backfilling.
        """
        logger.info(
            "Batch collecting proposal outcomes",
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
        )
        
        outcomes = []
        offset = 0
        
        while True:
            batch = await self.db.query(
                "proposals",
                {
                    "status": {"$in": ["accepted", "rejected", "withdrawn"]},
                    "updated_at": {
                        "$gte": start_date,
                        "$lt": end_date,
                    },
                },
                limit=self.batch_size,
                offset=offset,
            )
            
            if not batch:
                break
            
            for proposal in batch:
                outcome = await self._create_outcome_from_proposal(proposal)
                outcomes.append(outcome)
            
            offset += len(batch)
        
        # Create dataset
        dataset = TrainingDataset(
            dataset_id=f"proposal_outcomes_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            created_at=datetime.utcnow(),
            num_samples=len(outcomes),
            outcome_distribution=self._calculate_distribution(outcomes),
            date_range={"start": start_date.isoformat(), "end": end_date.isoformat()},
            version="1.0.0",
        )
        
        # Store dataset
        await self.storage.save_dataset(
            dataset.dataset_id,
            outcomes,
            dataset.model_dump(),
        )
        
        return dataset
    
    async def _create_outcome_from_proposal(self, proposal: dict) -> ProposalOutcome:
        """Create outcome record from proposal document."""
        job_data = await self._fetch_job_data(proposal["job_id"])
        
        outcome_map = {
            "accepted": "won",
            "rejected": "lost",
            "withdrawn": "withdrawn",
        }
        
        return ProposalOutcome(
            proposal_id=proposal["id"],
            job_id=proposal["job_id"],
            user_id=proposal["user_id"],
            job_post={
                "title": job_data["title"],
                "description": job_data["description"],
                "skills": job_data.get("skills", []),
            },
            proposal_content=proposal["content"],
            outcome=outcome_map[proposal["status"]],
            proposed_rate=proposal["rate"],
            collected_at=datetime.utcnow(),
        )
    
    def _calculate_distribution(self, outcomes: List[ProposalOutcome]) -> dict:
        """Calculate outcome distribution."""
        distribution = {"won": 0, "lost": 0, "withdrawn": 0}
        for outcome in outcomes:
            distribution[outcome.outcome] += 1
        return distribution
    
    # -------------------------------------------------------------------------
    # DATA QUALITY
    # -------------------------------------------------------------------------
    
    async def validate_outcome(self, outcome: ProposalOutcome) -> bool:
        """Validate outcome data quality."""
        validations = [
            len(outcome.proposal_content) >= 50,  # Minimum content length
            outcome.proposed_rate > 0,
            outcome.job_post.get("description"),
            outcome.user_id is not None,
        ]
        
        return all(validations)
    
    async def get_collection_stats(self) -> dict:
        """Get collection statistics."""
        total = await self.db.count("proposal_training_data", {})
        processed = await self.db.count("proposal_training_data", {"processed": True})
        
        by_outcome = {}
        for outcome in ["won", "lost", "withdrawn"]:
            by_outcome[outcome] = await self.db.count(
                "proposal_training_data",
                {"outcome": outcome},
            )
        
        return {
            "total_samples": total,
            "processed_samples": processed,
            "unprocessed_samples": total - processed,
            "by_outcome": by_outcome,
        }
