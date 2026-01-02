"""
Proposal AI Routes
API endpoints for AI-powered proposal assistance
Sprint M7: AI Work Assistant
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
import structlog

from app.api.proposal_ai import ProposalAIService
from app.api.proposal_analyzer import ProposalAnalyzer

router = APIRouter(prefix="/ai/proposal", tags=["Proposal AI"])
logger = structlog.get_logger()


# =============================================================================
# REQUEST/RESPONSE SCHEMAS
# =============================================================================

class AnalyzeJobRequest(BaseModel):
    """Request to analyze a job posting"""
    job_id: str
    job_title: str
    job_description: str
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    client_history: Optional[dict] = None


class AnalyzeJobResponse(BaseModel):
    """Response with job analysis insights"""
    job_id: str
    key_requirements: List[str]
    client_priorities: List[str]
    budget_signals: dict
    tone_preference: str
    urgency_level: str
    competition_estimate: str
    keywords: List[str]
    red_flags: List[str]
    opportunities: List[str]
    processing_time_ms: int


class GenerateSuggestionsRequest(BaseModel):
    """Request to generate proposal suggestions"""
    job_id: str
    job_description: str
    freelancer_context: dict = Field(
        ...,
        description="Freelancer profile, skills, and past work"
    )
    tone: Optional[str] = "professional"
    focus_areas: Optional[List[str]] = None


class GenerateSuggestionsResponse(BaseModel):
    """Response with generated proposal suggestions"""
    job_id: str
    opening_hooks: List[dict]
    experience_highlights: List[str]
    questions_to_ask: List[str]
    closing_cta: List[str]
    personalization_tips: List[str]
    tone_recommendations: str
    optimal_length: dict
    confidence: float


class ScoreProposalRequest(BaseModel):
    """Request to score a proposal draft"""
    job_id: str
    job_description: str
    proposal_text: str
    freelancer_id: str


class ScoreProposalResponse(BaseModel):
    """Response with proposal score and feedback"""
    overall_score: int = Field(..., ge=0, le=100)
    category_scores: dict
    strengths: List[str]
    improvements: List[str]
    win_probability: float
    comparison_to_winners: dict
    suggested_rewrites: Optional[List[dict]] = None


class ImproveProposalRequest(BaseModel):
    """Request to improve a specific section"""
    job_id: str
    job_description: str
    section_text: str
    section_type: str = Field(
        ...,
        description="opening, body, closing, or full"
    )
    improvement_focus: Optional[str] = None


class ImproveProposalResponse(BaseModel):
    """Response with improved section options"""
    original_text: str
    improved_versions: List[dict]
    changes_explained: List[str]
    confidence: float


class ProposalFeedbackRequest(BaseModel):
    """Request to record feedback on AI suggestions"""
    suggestion_id: str
    job_id: str
    feedback_type: str = Field(
        ...,
        description="helpful, not_helpful, used, modified, ignored"
    )
    suggestion_type: str
    comment: Optional[str] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/analyze-job", response_model=AnalyzeJobResponse)
async def analyze_job(
    request: AnalyzeJobRequest,
    background_tasks: BackgroundTasks,
) -> AnalyzeJobResponse:
    """
    Analyze a job posting to extract key insights.
    
    Returns:
    - Key requirements and must-haves
    - Client priorities and preferences
    - Budget signals and expectations
    - Tone preferences
    - Red flags and opportunities
    """
    import time
    start_time = time.time()
    
    logger.info(
        "Analyzing job posting",
        job_id=request.job_id,
    )
    
    try:
        # Initialize service (would be dependency-injected in production)
        service = ProposalAIService(
            llm_client=None,  # Injected
            proposal_model=None,  # Injected
            metrics=None,  # Injected
        )
        
        analysis = await service.analyze_job({
            "id": request.job_id,
            "title": request.job_title,
            "description": request.job_description,
            "budget_min": request.budget_min,
            "budget_max": request.budget_max,
            "client_history": request.client_history,
        })
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Track analysis for model improvement
        background_tasks.add_task(
            _track_job_analysis,
            request.job_id,
            analysis,
        )
        
        return AnalyzeJobResponse(
            job_id=request.job_id,
            key_requirements=analysis.key_requirements,
            client_priorities=analysis.client_priorities,
            budget_signals=analysis.budget_signals,
            tone_preference=analysis.tone_preference,
            urgency_level=analysis.urgency_level,
            competition_estimate=analysis.competition_estimate,
            keywords=analysis.keywords,
            red_flags=analysis.red_flags,
            opportunities=analysis.opportunities,
            processing_time_ms=processing_time,
        )
        
    except Exception as e:
        logger.error(
            "Job analysis failed",
            job_id=request.job_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze job: {str(e)}"
        )


@router.post("/generate-suggestions", response_model=GenerateSuggestionsResponse)
async def generate_suggestions(
    request: GenerateSuggestionsRequest,
    background_tasks: BackgroundTasks,
) -> GenerateSuggestionsResponse:
    """
    Generate personalized proposal suggestions.
    
    Uses freelancer profile and job requirements to generate:
    - Opening hook options
    - Experience highlights to emphasize
    - Questions to ask the client
    - Closing call-to-action options
    """
    logger.info(
        "Generating proposal suggestions",
        job_id=request.job_id,
        freelancer_id=request.freelancer_context.get("user_id"),
    )
    
    try:
        service = ProposalAIService(
            llm_client=None,
            proposal_model=None,
            metrics=None,
        )
        
        suggestions = await service.generate_suggestions(
            job_post={"id": request.job_id, "description": request.job_description},
            freelancer_context=request.freelancer_context,
            tone=request.tone,
            focus_areas=request.focus_areas,
        )
        
        # Track for A/B testing
        background_tasks.add_task(
            _track_suggestion_generation,
            request.job_id,
            request.freelancer_context.get("user_id"),
            suggestions,
        )
        
        return GenerateSuggestionsResponse(
            job_id=request.job_id,
            opening_hooks=suggestions.opening_hooks,
            experience_highlights=suggestions.experience_highlights,
            questions_to_ask=suggestions.questions_to_ask,
            closing_cta=suggestions.closing_cta,
            personalization_tips=suggestions.personalization_tips,
            tone_recommendations=suggestions.tone_recommendations,
            optimal_length=suggestions.optimal_length,
            confidence=suggestions.confidence,
        )
        
    except Exception as e:
        logger.error(
            "Suggestion generation failed",
            job_id=request.job_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate suggestions: {str(e)}"
        )


@router.post("/score", response_model=ScoreProposalResponse)
async def score_proposal(
    request: ScoreProposalRequest,
    background_tasks: BackgroundTasks,
) -> ScoreProposalResponse:
    """
    Score a proposal draft and provide improvement suggestions.
    
    Evaluates:
    - Requirement coverage
    - Personalization level
    - Tone and clarity
    - Call-to-action strength
    - Win probability
    """
    logger.info(
        "Scoring proposal",
        job_id=request.job_id,
        freelancer_id=request.freelancer_id,
    )
    
    try:
        analyzer = ProposalAnalyzer(
            llm_client=None,
            metrics=None,
        )
        
        score = await analyzer.analyze_proposal(
            job_post={"id": request.job_id, "description": request.job_description},
            proposal_text=request.proposal_text,
            freelancer_id=request.freelancer_id,
        )
        
        # Track scoring for model calibration
        background_tasks.add_task(
            _track_proposal_scoring,
            request.job_id,
            request.freelancer_id,
            score.overall_score,
        )
        
        return ScoreProposalResponse(
            overall_score=score.overall_score,
            category_scores=score.category_scores,
            strengths=score.strengths,
            improvements=score.improvements,
            win_probability=score.win_probability,
            comparison_to_winners=score.comparison_to_winners,
            suggested_rewrites=score.suggested_rewrites,
        )
        
    except Exception as e:
        logger.error(
            "Proposal scoring failed",
            job_id=request.job_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to score proposal: {str(e)}"
        )


@router.post("/improve", response_model=ImproveProposalResponse)
async def improve_proposal_section(
    request: ImproveProposalRequest,
) -> ImproveProposalResponse:
    """
    Improve a specific section of the proposal.
    
    Returns multiple rewritten versions with explanations
    of the changes made.
    """
    logger.info(
        "Improving proposal section",
        job_id=request.job_id,
        section_type=request.section_type,
    )
    
    try:
        service = ProposalAIService(
            llm_client=None,
            proposal_model=None,
            metrics=None,
        )
        
        improvement = await service.improve_section(
            job_post={"id": request.job_id, "description": request.job_description},
            section_text=request.section_text,
            section_type=request.section_type,
            focus=request.improvement_focus,
        )
        
        return ImproveProposalResponse(
            original_text=request.section_text,
            improved_versions=improvement.versions,
            changes_explained=improvement.explanations,
            confidence=improvement.confidence,
        )
        
    except Exception as e:
        logger.error(
            "Section improvement failed",
            job_id=request.job_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to improve section: {str(e)}"
        )


@router.post("/feedback")
async def record_feedback(
    request: ProposalFeedbackRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Record user feedback on AI suggestions.
    
    This feedback is used to:
    - Improve model accuracy
    - A/B test different approaches
    - Personalize future suggestions
    """
    logger.info(
        "Recording proposal AI feedback",
        suggestion_id=request.suggestion_id,
        feedback_type=request.feedback_type,
    )
    
    # Queue feedback processing
    background_tasks.add_task(
        _process_feedback,
        request.suggestion_id,
        request.job_id,
        request.feedback_type,
        request.suggestion_type,
        request.comment,
    )
    
    return {
        "status": "recorded",
        "suggestion_id": request.suggestion_id,
    }


# =============================================================================
# BACKGROUND TASKS
# =============================================================================

async def _track_job_analysis(job_id: str, analysis: dict):
    """Track job analysis for model improvement."""
    # Store analysis for future reference
    pass


async def _track_suggestion_generation(
    job_id: str,
    freelancer_id: str,
    suggestions: dict,
):
    """Track generated suggestions for A/B testing."""
    # Store suggestion variants and metadata
    pass


async def _track_proposal_scoring(
    job_id: str,
    freelancer_id: str,
    score: int,
):
    """Track proposal scores for model calibration."""
    # Store score with proposal ID for outcome tracking
    pass


async def _process_feedback(
    suggestion_id: str,
    job_id: str,
    feedback_type: str,
    suggestion_type: str,
    comment: Optional[str],
):
    """Process user feedback for model improvement."""
    # Store and aggregate feedback
    # Trigger retraining if threshold met
    pass
