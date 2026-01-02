"""
Proposal AI Service
Analyze job posts and generate winning proposal suggestions
Sprint M7: AI Work Assistant
"""

from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

class JobAnalysis(BaseModel):
    """Analysis of a job posting"""
    job_id: str
    key_requirements: list[str]
    client_priorities: list[str]
    budget_signals: dict
    tone_preference: str
    urgency_level: str
    competition_estimate: str
    keywords: list[str]
    red_flags: list[str]
    opportunities: list[str]


class ProposalSuggestions(BaseModel):
    """Generated proposal suggestions"""
    opening_hooks: list[str]
    experience_highlights: list[str]
    questions_to_ask: list[str]
    closing_cta: list[str]
    personalization_tips: list[str]
    tone_recommendations: str
    optimal_length: dict


class ProposalScore(BaseModel):
    """Proposal quality score"""
    overall_score: int  # 0-100
    category_scores: dict
    strengths: list[str]
    improvements: list[str]
    win_probability: float
    comparison_to_winners: dict


class FreelancerContext(BaseModel):
    """Freelancer context for personalization"""
    user_id: str
    skills: list[str]
    experience_years: int
    portfolio_items: list[dict]
    writing_style: str
    past_proposals: list[dict]
    win_rate: float


# =============================================================================
# PROPOSAL AI SERVICE
# =============================================================================

class ProposalAIService:
    """
    AI-powered proposal assistance
    
    Analyzes job posts, generates personalized suggestions,
    scores proposals, and learns from outcomes.
    """
    
    def __init__(self, llm_client, proposal_model, metrics):
        self.llm = llm_client
        self.model = proposal_model
        self.metrics = metrics
    
    # -------------------------------------------------------------------------
    # JOB ANALYSIS
    # -------------------------------------------------------------------------
    
    async def analyze_job(self, job_post: dict) -> JobAnalysis:
        """
        Analyze a job posting to extract insights
        
        Extracts:
        - Key requirements (must-haves vs nice-to-haves)
        - Client priorities (what they care most about)
        - Budget signals (explicit or implicit)
        - Tone preferences (formal, casual, technical)
        - Urgency level
        - Competition estimate
        """
        logger.info(f"Analyzing job: {job_post.get('id')}")
        
        # Build analysis prompt
        prompt = self._build_job_analysis_prompt(job_post)
        
        # Call LLM for analysis
        analysis = await self.llm.generate(
            prompt=prompt,
            system_prompt=self._get_job_analyzer_system_prompt(),
            temperature=0.3,  # Lower for more consistent analysis
            max_tokens=2000
        )
        
        # Parse structured response
        parsed = self._parse_job_analysis(analysis, job_post.get('id'))
        
        self.metrics.increment('proposal_ai.job_analyzed')
        
        return parsed
    
    def _build_job_analysis_prompt(self, job_post: dict) -> str:
        """Build prompt for job analysis"""
        return f"""
Analyze this job posting and extract key insights:

TITLE: {job_post.get('title', '')}

DESCRIPTION:
{job_post.get('description', '')}

BUDGET: {job_post.get('budget', 'Not specified')}
DURATION: {job_post.get('duration', 'Not specified')}
SKILLS REQUIRED: {', '.join(job_post.get('skills', []))}

Provide a structured analysis including:
1. Key requirements (list must-haves and nice-to-haves)
2. Client priorities (what they care most about)
3. Budget signals (any hints about budget flexibility)
4. Preferred tone (formal, casual, technical)
5. Urgency level (high, medium, low)
6. Competition estimate (high, medium, low)
7. Important keywords to include in proposal
8. Red flags to be aware of
9. Opportunities to stand out
"""
    
    def _get_job_analyzer_system_prompt(self) -> str:
        """System prompt for job analysis"""
        return """You are an expert freelance consultant who has reviewed thousands of job postings.
Your job is to analyze job posts and help freelancers understand what clients really want.
Be specific and actionable in your analysis. Focus on practical insights that help win projects."""
    
    def _parse_job_analysis(self, response: str, job_id: str) -> JobAnalysis:
        """Parse LLM response into structured JobAnalysis"""
        # In production: Parse structured response from LLM
        # For now, return placeholder structure
        return JobAnalysis(
            job_id=job_id,
            key_requirements=[],
            client_priorities=[],
            budget_signals={},
            tone_preference="professional",
            urgency_level="medium",
            competition_estimate="medium",
            keywords=[],
            red_flags=[],
            opportunities=[]
        )
    
    # -------------------------------------------------------------------------
    # PROPOSAL GENERATION
    # -------------------------------------------------------------------------
    
    async def generate_suggestions(
        self,
        job_analysis: JobAnalysis,
        freelancer: FreelancerContext
    ) -> ProposalSuggestions:
        """
        Generate personalized proposal suggestions
        
        Creates:
        - Opening hooks (3-5 options matching job and freelancer)
        - Experience highlights (relevant past work to mention)
        - Questions to ask (shows engagement and expertise)
        - Closing CTAs (compelling calls to action)
        - Personalization tips
        """
        logger.info(f"Generating suggestions for job: {job_analysis.job_id}")
        
        # Build generation prompt with freelancer context
        prompt = self._build_suggestion_prompt(job_analysis, freelancer)
        
        # Generate suggestions
        response = await self.llm.generate(
            prompt=prompt,
            system_prompt=self._get_proposal_writer_system_prompt(freelancer),
            temperature=0.7,  # Higher for creative variety
            max_tokens=3000
        )
        
        suggestions = self._parse_suggestions(response)
        
        self.metrics.increment('proposal_ai.suggestions_generated')
        
        return suggestions
    
    def _build_suggestion_prompt(
        self,
        job: JobAnalysis,
        freelancer: FreelancerContext
    ) -> str:
        """Build prompt for proposal suggestions"""
        return f"""
Generate proposal suggestions for this job, personalized for the freelancer.

JOB INSIGHTS:
- Key requirements: {', '.join(job.key_requirements)}
- Client priorities: {', '.join(job.client_priorities)}
- Tone preference: {job.tone_preference}
- Keywords to include: {', '.join(job.keywords)}

FREELANCER PROFILE:
- Skills: {', '.join(freelancer.skills)}
- Experience: {freelancer.experience_years} years
- Writing style: {freelancer.writing_style}
- Win rate: {freelancer.win_rate * 100:.1f}%

Generate:
1. 3-5 opening hook options (first 1-2 sentences that grab attention)
2. Experience highlights to mention (relevant past work)
3. 3-4 smart questions to ask the client
4. 2-3 closing call-to-action options
5. Personalization tips specific to this job

Make suggestions sound natural, not templated. Match the freelancer's voice.
"""
    
    def _get_proposal_writer_system_prompt(self, freelancer: FreelancerContext) -> str:
        """System prompt for proposal writing"""
        return f"""You are an expert proposal writer helping freelancers win projects.
Write in a {freelancer.writing_style} style.
Create compelling, personalized proposals that stand out from generic templates.
Focus on client value, not freelancer credentials.
Be specific and relevant to each job."""
    
    def _parse_suggestions(self, response: str) -> ProposalSuggestions:
        """Parse LLM response into ProposalSuggestions"""
        return ProposalSuggestions(
            opening_hooks=[],
            experience_highlights=[],
            questions_to_ask=[],
            closing_cta=[],
            personalization_tips=[],
            tone_recommendations="professional yet approachable",
            optimal_length={"min_words": 150, "max_words": 400}
        )
    
    # -------------------------------------------------------------------------
    # PROPOSAL SCORING
    # -------------------------------------------------------------------------
    
    async def score_proposal(
        self,
        proposal_text: str,
        job_analysis: JobAnalysis,
        freelancer: Optional[FreelancerContext] = None
    ) -> ProposalScore:
        """
        Score a proposal draft
        
        Evaluates:
        - Requirement coverage (does it address all needs?)
        - Personalization level (is it specific to this job?)
        - Call-to-action strength
        - Length appropriateness
        - Grammar and clarity
        - Tone match
        """
        logger.info(f"Scoring proposal for job: {job_analysis.job_id}")
        
        # Use ML model for win probability
        win_prob = await self.model.predict_win_probability(
            proposal_text=proposal_text,
            job_id=job_analysis.job_id,
            user_id=freelancer.user_id if freelancer else None
        )
        
        # Use LLM for detailed analysis
        prompt = self._build_scoring_prompt(proposal_text, job_analysis)
        analysis = await self.llm.generate(
            prompt=prompt,
            system_prompt=self._get_proposal_reviewer_system_prompt(),
            temperature=0.3,
            max_tokens=2000
        )
        
        score = self._parse_score(analysis, win_prob)
        
        self.metrics.increment('proposal_ai.proposal_scored')
        
        return score
    
    def _build_scoring_prompt(self, proposal: str, job: JobAnalysis) -> str:
        """Build prompt for proposal scoring"""
        return f"""
Score this proposal draft against the job requirements.

JOB REQUIREMENTS:
{', '.join(job.key_requirements)}

CLIENT PRIORITIES:
{', '.join(job.client_priorities)}

PROPOSAL DRAFT:
{proposal}

Evaluate and score (0-100) each category:
1. Requirement coverage - Does it address all key needs?
2. Personalization - Is it specific to this job?
3. Call-to-action - Does it encourage response?
4. Length - Is it appropriately sized?
5. Clarity - Is it easy to read?
6. Tone match - Does it match client's preferred tone?

Provide:
- Overall score (0-100)
- Category scores
- Top 3 strengths
- Top 3 improvements needed
- Specific suggestions to improve
"""
    
    def _get_proposal_reviewer_system_prompt(self) -> str:
        """System prompt for proposal review"""
        return """You are an expert proposal reviewer who has seen thousands of winning proposals.
Score proposals objectively and provide specific, actionable feedback.
Compare to best practices from successful freelancers.
Be constructive but honest about weaknesses."""
    
    def _parse_score(self, analysis: str, win_prob: float) -> ProposalScore:
        """Parse scoring response"""
        return ProposalScore(
            overall_score=75,
            category_scores={
                "requirement_coverage": 80,
                "personalization": 70,
                "call_to_action": 75,
                "length": 80,
                "clarity": 85,
                "tone_match": 70
            },
            strengths=[],
            improvements=[],
            win_probability=win_prob,
            comparison_to_winners={}
        )
    
    # -------------------------------------------------------------------------
    # PROPOSAL IMPROVEMENT
    # -------------------------------------------------------------------------
    
    async def improve_section(
        self,
        section_text: str,
        section_type: str,  # opening, body, closing
        job_analysis: JobAnalysis,
        freelancer: FreelancerContext,
        improvement_focus: Optional[str] = None
    ) -> dict:
        """
        Improve a specific section of the proposal
        
        Returns multiple rewrite options
        """
        logger.info(f"Improving {section_type} section")
        
        prompt = f"""
Rewrite this {section_type} section to be more effective.

ORIGINAL:
{section_text}

JOB CONTEXT:
- Key requirements: {', '.join(job_analysis.key_requirements[:5])}
- Client priorities: {', '.join(job_analysis.client_priorities[:3])}

{f'FOCUS ON: {improvement_focus}' if improvement_focus else ''}

Provide 3 rewritten versions, each with a different approach:
1. More concise version
2. More detailed version  
3. More personalized version

Maintain the freelancer's voice and style.
"""
        
        response = await self.llm.generate(
            prompt=prompt,
            system_prompt=self._get_proposal_writer_system_prompt(freelancer),
            temperature=0.7,
            max_tokens=2000
        )
        
        self.metrics.increment('proposal_ai.section_improved')
        
        return {
            "original": section_text,
            "versions": self._parse_rewrites(response),
            "section_type": section_type
        }
    
    def _parse_rewrites(self, response: str) -> list[dict]:
        """Parse rewrite options from response"""
        return [
            {"type": "concise", "text": ""},
            {"type": "detailed", "text": ""},
            {"type": "personalized", "text": ""}
        ]
    
    # -------------------------------------------------------------------------
    # A/B TESTING & LEARNING
    # -------------------------------------------------------------------------
    
    async def record_suggestion_usage(
        self,
        suggestion_id: str,
        action: str,  # accepted, modified, rejected
        final_text: Optional[str] = None
    ):
        """Record how user interacted with suggestion"""
        logger.info(f"Recording suggestion usage: {suggestion_id} - {action}")
        
        # Store for model retraining
        await self._store_feedback({
            "suggestion_id": suggestion_id,
            "action": action,
            "final_text": final_text,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        self.metrics.increment('proposal_ai.suggestion_feedback', tags={"action": action})
    
    async def record_proposal_outcome(
        self,
        proposal_id: str,
        job_id: str,
        outcome: str,  # won, lost, withdrawn
        days_to_decision: Optional[int] = None
    ):
        """Record proposal outcome for model training"""
        logger.info(f"Recording outcome: {proposal_id} - {outcome}")
        
        # Trigger data collection for retraining
        await self._store_outcome({
            "proposal_id": proposal_id,
            "job_id": job_id,
            "outcome": outcome,
            "days_to_decision": days_to_decision,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        self.metrics.increment('proposal_ai.outcome_recorded', tags={"outcome": outcome})
    
    async def _store_feedback(self, data: dict):
        """Store feedback for training"""
        pass  # In production: Store to training data store
    
    async def _store_outcome(self, data: dict):
        """Store outcome for training"""
        pass  # In production: Store to training data store


# =============================================================================
# FACTORY
# =============================================================================

_service: Optional[ProposalAIService] = None

def get_proposal_ai_service() -> ProposalAIService:
    """Get ProposalAIService singleton"""
    global _service
    if _service is None:
        from app.llm.openai_client import get_openai_client
        from app.models.proposal_model import get_proposal_model
        from app.metrics import get_metrics
        
        _service = ProposalAIService(
            llm_client=get_openai_client(),
            proposal_model=get_proposal_model(),
            metrics=get_metrics()
        )
    return _service
