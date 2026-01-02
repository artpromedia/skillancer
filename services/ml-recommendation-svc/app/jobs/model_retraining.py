"""
Model Retraining Job
Scheduled job for retraining ML models
Sprint M7: AI Work Assistant
"""

from typing import Optional, List, Dict
from pydantic import BaseModel
from datetime import datetime, timedelta
from enum import Enum
import structlog
import asyncio

logger = structlog.get_logger()


# =============================================================================
# TYPES
# =============================================================================

class ModelType(str, Enum):
    PROPOSAL_SUCCESS = "proposal_success"
    RATE_OPTIMIZATION = "rate_optimization"
    CAREER_TRAJECTORY = "career_trajectory"


class RetrainingStatus(str, Enum):
    PENDING = "pending"
    COLLECTING_DATA = "collecting_data"
    VALIDATING = "validating"
    TRAINING = "training"
    EVALUATING = "evaluating"
    AB_TESTING = "ab_testing"
    PROMOTING = "promoting"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class RetrainingJob(BaseModel):
    """Retraining job record"""
    job_id: str
    model_type: ModelType
    status: RetrainingStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    training_samples: int = 0
    validation_samples: int = 0
    metrics: Dict = {}
    error: Optional[str] = None
    promoted: bool = False


class ModelMetrics(BaseModel):
    """Model evaluation metrics"""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    auc_roc: float
    mean_squared_error: Optional[float] = None
    custom_metrics: Dict = {}


class ABTestResult(BaseModel):
    """A/B test results"""
    test_id: str
    model_a_version: str
    model_b_version: str
    metric_name: str
    model_a_value: float
    model_b_value: float
    p_value: float
    winner: str
    sample_size: int
    duration_hours: int


# =============================================================================
# MODEL RETRAINING JOB
# =============================================================================

class ModelRetrainingJob:
    """
    Scheduled model retraining job.
    
    Runs weekly (or on trigger) to:
    1. Collect new training data
    2. Validate data quality
    3. Retrain models
    4. Evaluate new model
    5. A/B test vs current
    6. Promote if improved
    """
    
    def __init__(
        self,
        db,
        storage,
        model_registry,
        metrics,
        alert_service,
    ):
        self.db = db
        self.storage = storage
        self.model_registry = model_registry
        self.metrics = metrics
        self.alert_service = alert_service
        
        # Configuration
        self.min_training_samples = 1000
        self.min_improvement_threshold = 0.02  # 2% improvement required
        self.ab_test_duration_hours = 48
        self.max_training_hours = 4
    
    # -------------------------------------------------------------------------
    # MAIN RETRAINING FLOW
    # -------------------------------------------------------------------------
    
    async def run(
        self,
        model_type: ModelType,
        force: bool = False,
    ) -> RetrainingJob:
        """
        Run the retraining pipeline for a model.
        
        Args:
            model_type: Which model to retrain
            force: Force retraining even if threshold not met
        """
        job = RetrainingJob(
            job_id=f"retrain_{model_type.value}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            model_type=model_type,
            status=RetrainingStatus.PENDING,
            started_at=datetime.utcnow(),
        )
        
        logger.info(
            "Starting model retraining",
            job_id=job.job_id,
            model_type=model_type.value,
        )
        
        try:
            # Step 1: Collect training data
            job.status = RetrainingStatus.COLLECTING_DATA
            training_data, validation_data = await self._collect_training_data(
                model_type,
                force,
            )
            job.training_samples = len(training_data)
            job.validation_samples = len(validation_data)
            
            # Check if enough data
            if not force and job.training_samples < self.min_training_samples:
                logger.info(
                    "Insufficient training data, skipping retraining",
                    samples=job.training_samples,
                    required=self.min_training_samples,
                )
                job.status = RetrainingStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                return job
            
            # Step 2: Validate data quality
            job.status = RetrainingStatus.VALIDATING
            data_quality = await self._validate_data_quality(training_data)
            if not data_quality["valid"]:
                raise ValueError(f"Data quality check failed: {data_quality['issues']}")
            
            # Step 3: Train new model
            job.status = RetrainingStatus.TRAINING
            new_model = await self._train_model(
                model_type,
                training_data,
            )
            
            # Step 4: Evaluate new model
            job.status = RetrainingStatus.EVALUATING
            new_metrics = await self._evaluate_model(
                new_model,
                validation_data,
            )
            job.metrics["new_model"] = new_metrics.model_dump()
            
            # Get current model metrics
            current_metrics = await self._get_current_model_metrics(model_type)
            job.metrics["current_model"] = current_metrics.model_dump()
            
            # Check if improvement is significant
            improvement = self._calculate_improvement(
                current_metrics,
                new_metrics,
            )
            job.metrics["improvement"] = improvement
            
            if improvement < self.min_improvement_threshold and not force:
                logger.info(
                    "New model did not meet improvement threshold",
                    improvement=improvement,
                    threshold=self.min_improvement_threshold,
                )
                job.status = RetrainingStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                return job
            
            # Step 5: A/B test
            job.status = RetrainingStatus.AB_TESTING
            ab_result = await self._run_ab_test(
                model_type,
                new_model,
            )
            job.metrics["ab_test"] = ab_result.model_dump()
            
            # Step 6: Promote if winner
            if ab_result.winner == "model_b":  # New model
                job.status = RetrainingStatus.PROMOTING
                await self._promote_model(model_type, new_model)
                job.promoted = True
                
                # Send notification
                await self.alert_service.send_notification(
                    "model_promoted",
                    {
                        "model_type": model_type.value,
                        "improvement": improvement,
                        "new_version": new_model.version,
                    },
                )
            else:
                logger.info(
                    "New model did not win A/B test, keeping current",
                    model_type=model_type.value,
                )
            
            job.status = RetrainingStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            
            # Track metrics
            self.metrics.gauge(
                "model_retraining_improvement",
                improvement,
                tags={"model_type": model_type.value},
            )
            
            return job
            
        except Exception as e:
            logger.error(
                "Model retraining failed",
                job_id=job.job_id,
                error=str(e),
            )
            
            job.status = RetrainingStatus.FAILED
            job.error = str(e)
            job.completed_at = datetime.utcnow()
            
            # Send alert
            await self.alert_service.send_alert(
                "model_retraining_failed",
                severity="high",
                details={
                    "job_id": job.job_id,
                    "model_type": model_type.value,
                    "error": str(e),
                },
            )
            
            return job
        
        finally:
            # Store job record
            await self._store_job_record(job)
    
    # -------------------------------------------------------------------------
    # DATA COLLECTION
    # -------------------------------------------------------------------------
    
    async def _collect_training_data(
        self,
        model_type: ModelType,
        include_all: bool = False,
    ) -> tuple:
        """Collect training and validation data."""
        logger.debug(
            "Collecting training data",
            model_type=model_type.value,
        )
        
        # Get date range
        if include_all:
            start_date = datetime(2020, 1, 1)
        else:
            start_date = datetime.utcnow() - timedelta(days=90)
        end_date = datetime.utcnow()
        
        # Collection based on model type
        if model_type == ModelType.PROPOSAL_SUCCESS:
            data = await self._collect_proposal_data(start_date, end_date)
        elif model_type == ModelType.RATE_OPTIMIZATION:
            data = await self._collect_rate_data(start_date, end_date)
        elif model_type == ModelType.CAREER_TRAJECTORY:
            data = await self._collect_career_data(start_date, end_date)
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        # Split train/validation (80/20)
        split_idx = int(len(data) * 0.8)
        return data[:split_idx], data[split_idx:]
    
    async def _collect_proposal_data(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> List[dict]:
        """Collect proposal outcome data."""
        return await self.db.query(
            "proposal_training_data",
            {
                "collected_at": {
                    "$gte": start_date,
                    "$lt": end_date,
                },
                "processed": False,
            },
        )
    
    async def _collect_rate_data(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> List[dict]:
        """Collect rate outcome data."""
        return await self.db.query(
            "rate_training_data",
            {
                "collected_at": {
                    "$gte": start_date,
                    "$lt": end_date,
                },
            },
        )
    
    async def _collect_career_data(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> List[dict]:
        """Collect career trajectory data."""
        return await self.db.query(
            "career_training_data",
            {
                "collected_at": {
                    "$gte": start_date,
                    "$lt": end_date,
                },
            },
        )
    
    # -------------------------------------------------------------------------
    # DATA VALIDATION
    # -------------------------------------------------------------------------
    
    async def _validate_data_quality(self, data: List[dict]) -> dict:
        """Validate training data quality."""
        issues = []
        
        # Check for missing values
        missing_rate = sum(1 for d in data if any(v is None for v in d.values())) / len(data)
        if missing_rate > 0.1:
            issues.append(f"High missing value rate: {missing_rate:.2%}")
        
        # Check for class imbalance
        if "outcome" in data[0]:
            outcomes = [d["outcome"] for d in data]
            outcome_counts = {}
            for o in outcomes:
                outcome_counts[o] = outcome_counts.get(o, 0) + 1
            
            min_count = min(outcome_counts.values())
            max_count = max(outcome_counts.values())
            if max_count / min_count > 10:
                issues.append(f"Severe class imbalance: {outcome_counts}")
        
        # Check for data freshness
        if data:
            latest = max(d.get("collected_at", datetime.min) for d in data)
            if datetime.utcnow() - latest > timedelta(days=7):
                issues.append("Data may be stale")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "sample_size": len(data),
            "missing_rate": missing_rate,
        }
    
    # -------------------------------------------------------------------------
    # MODEL TRAINING
    # -------------------------------------------------------------------------
    
    async def _train_model(
        self,
        model_type: ModelType,
        training_data: List[dict],
    ):
        """Train new model version."""
        logger.info(
            "Training model",
            model_type=model_type.value,
            samples=len(training_data),
        )
        
        # In production: Actual ML training
        # This would use PyTorch, scikit-learn, or similar
        
        # Placeholder for trained model
        class TrainedModel:
            def __init__(self, model_type, version):
                self.model_type = model_type
                self.version = version
                self.trained_at = datetime.utcnow()
        
        new_version = f"{model_type.value}_v{datetime.utcnow().strftime('%Y%m%d%H%M')}"
        return TrainedModel(model_type, new_version)
    
    async def _evaluate_model(
        self,
        model,
        validation_data: List[dict],
    ) -> ModelMetrics:
        """Evaluate model on validation set."""
        logger.info(
            "Evaluating model",
            model_type=model.model_type.value,
            validation_samples=len(validation_data),
        )
        
        # In production: Calculate actual metrics
        return ModelMetrics(
            accuracy=0.85,
            precision=0.82,
            recall=0.88,
            f1_score=0.85,
            auc_roc=0.91,
        )
    
    async def _get_current_model_metrics(
        self,
        model_type: ModelType,
    ) -> ModelMetrics:
        """Get metrics for currently deployed model."""
        # In production: Fetch from model registry
        return ModelMetrics(
            accuracy=0.83,
            precision=0.80,
            recall=0.86,
            f1_score=0.83,
            auc_roc=0.89,
        )
    
    def _calculate_improvement(
        self,
        current: ModelMetrics,
        new: ModelMetrics,
    ) -> float:
        """Calculate relative improvement."""
        # Primary metric: F1 score
        return (new.f1_score - current.f1_score) / current.f1_score
    
    # -------------------------------------------------------------------------
    # A/B TESTING
    # -------------------------------------------------------------------------
    
    async def _run_ab_test(
        self,
        model_type: ModelType,
        new_model,
    ) -> ABTestResult:
        """Run A/B test between current and new model."""
        logger.info(
            "Starting A/B test",
            model_type=model_type.value,
            duration_hours=self.ab_test_duration_hours,
        )
        
        test_id = f"ab_{model_type.value}_{datetime.utcnow().strftime('%Y%m%d%H%M')}"
        
        # In production: Set up traffic split and wait
        # This is a simplified version
        
        return ABTestResult(
            test_id=test_id,
            model_a_version="current",
            model_b_version=new_model.version,
            metric_name="f1_score",
            model_a_value=0.83,
            model_b_value=0.85,
            p_value=0.03,
            winner="model_b",
            sample_size=1000,
            duration_hours=self.ab_test_duration_hours,
        )
    
    # -------------------------------------------------------------------------
    # MODEL PROMOTION
    # -------------------------------------------------------------------------
    
    async def _promote_model(self, model_type: ModelType, model):
        """Promote new model to production."""
        logger.info(
            "Promoting model",
            model_type=model_type.value,
            version=model.version,
        )
        
        # Register new model version
        await self.model_registry.register(
            model_type=model_type.value,
            version=model.version,
            artifacts=model,
            metadata={
                "trained_at": model.trained_at.isoformat(),
            },
        )
        
        # Update active version
        await self.model_registry.set_active(
            model_type=model_type.value,
            version=model.version,
        )
    
    async def _store_job_record(self, job: RetrainingJob):
        """Store job record for tracking."""
        await self.db.insert(
            "retraining_jobs",
            job.model_dump(),
        )
    
    # -------------------------------------------------------------------------
    # SCHEDULED EXECUTION
    # -------------------------------------------------------------------------
    
    async def scheduled_run(self):
        """
        Weekly scheduled retraining for all models.
        
        Called by scheduler (e.g., Celery beat, APScheduler).
        """
        logger.info("Starting scheduled model retraining")
        
        results = []
        for model_type in ModelType:
            try:
                result = await self.run(model_type)
                results.append({
                    "model_type": model_type.value,
                    "status": result.status.value,
                    "promoted": result.promoted,
                })
            except Exception as e:
                logger.error(
                    "Scheduled retraining failed for model",
                    model_type=model_type.value,
                    error=str(e),
                )
                results.append({
                    "model_type": model_type.value,
                    "status": "failed",
                    "error": str(e),
                })
        
        # Send summary notification
        await self.alert_service.send_notification(
            "scheduled_retraining_complete",
            {"results": results},
        )
        
        return results
