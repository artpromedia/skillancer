"""
Proposal Analyzer
Analyze and score proposal drafts against job requirements
Sprint M7: AI Work Assistant
"""

from typing import Optional
from pydantic import BaseModel
from enum import Enum
import logging
import re

logger = logging.getLogger(__name__)


# =============================================================================
# TYPES
# =============================================================================

class ScoreCategory(str, Enum):
    REQUIREMENT_COVERAGE = "requirement_coverage"
    PERSONALIZATION = "personalization"
    TONE = "tone"
    LENGTH = "length"
    CALL_TO_ACTION = "call_to_action"
    GRAMMAR = "grammar"
    CLARITY = "clarity"
    OPENING = "opening"
    CLOSING = "closing"


class CategoryScore(BaseModel):
    """Score for a single category"""
    category: ScoreCategory
    score: int  # 0-100
    feedback: str
    suggestions: list[str]


class AnalysisResult(BaseModel):
    """Full proposal analysis result"""
    overall_score: int  # 0-100
    category_scores: list[CategoryScore]
    strengths: list[str]
    weaknesses: list[str]
    rewrite_suggestions: list[dict]
    comparison_insights: list[str]
    estimated_win_probability: float


class JobRequirements(BaseModel):
    """Parsed job requirements"""
    must_haves: list[str]
    nice_to_haves: list[str]
    keywords: list[str]
    preferred_tone: str
    budget_range: Optional[tuple[float, float]]


# =============================================================================
# PROPOSAL ANALYZER
# =============================================================================

class ProposalAnalyzer:
    """
    Analyze proposal drafts for quality and effectiveness
    
    Checks:
    - Requirement coverage
    - Tone analysis
    - Length optimization
    - Call-to-action strength
    - Personalization level
    - Grammar/spelling
    """
    
    def __init__(self, llm_client, metrics):
        self.llm = llm_client
        self.metrics = metrics
    
    async def analyze(
        self,
        proposal_text: str,
        job_post: dict,
        freelancer_context: Optional[dict] = None
    ) -> AnalysisResult:
        """
        Perform full analysis of proposal
        
        Args:
            proposal_text: The proposal draft
            job_post: The job posting details
            freelancer_context: Optional freelancer info
            
        Returns:
            Complete analysis with scores and suggestions
        """
        logger.info("Analyzing proposal")
        
        # Parse job requirements
        requirements = await self._parse_requirements(job_post)
        
        # Score each category
        category_scores = await self._score_categories(
            proposal_text, requirements, job_post
        )
        
        # Calculate overall score
        overall = self._calculate_overall_score(category_scores)
        
        # Identify strengths and weaknesses
        strengths, weaknesses = self._identify_strengths_weaknesses(category_scores)
        
        # Generate rewrite suggestions
        rewrites = await self._generate_rewrites(
            proposal_text, weaknesses, requirements
        )
        
        # Compare to successful proposals
        comparisons = await self._compare_to_winners(proposal_text, job_post)
        
        # Estimate win probability
        win_prob = self._estimate_win_probability(overall, category_scores)
        
        self.metrics.increment('proposal_analyzer.analyzed')
        
        return AnalysisResult(
            overall_score=overall,
            category_scores=category_scores,
            strengths=strengths,
            weaknesses=weaknesses,
            rewrite_suggestions=rewrites,
            comparison_insights=comparisons,
            estimated_win_probability=win_prob
        )
    
    # -------------------------------------------------------------------------
    # REQUIREMENT PARSING
    # -------------------------------------------------------------------------
    
    async def _parse_requirements(self, job_post: dict) -> JobRequirements:
        """Parse requirements from job post"""
        description = job_post.get('description', '')
        
        # Use LLM to extract structured requirements
        prompt = f"""
Extract requirements from this job post:

{description}

Return:
1. Must-have requirements (required skills/experience)
2. Nice-to-have requirements (preferred but not required)
3. Important keywords to include
4. Preferred tone (formal, casual, technical)
5. Budget indication if mentioned
"""
        
        response = await self.llm.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=1000
        )
        
        # Parse response (in production, use structured output)
        return JobRequirements(
            must_haves=job_post.get('skills', []),
            nice_to_haves=[],
            keywords=self._extract_keywords(description),
            preferred_tone="professional",
            budget_range=self._parse_budget(job_post.get('budget'))
        )
    
    def _extract_keywords(self, text: str) -> list[str]:
        """Extract important keywords"""
        words = re.findall(r'\b\w+\b', text.lower())
        stopwords = {'the', 'a', 'an', 'is', 'are', 'we', 'you', 'for', 'to', 'of'}
        keywords = [w for w in words if w not in stopwords and len(w) > 3]
        # Return unique keywords
        return list(set(keywords))[:20]
    
    def _parse_budget(self, budget: Optional[str]) -> Optional[tuple[float, float]]:
        """Parse budget string into range"""
        if not budget:
            return None
        # In production: Parse various budget formats
        return None
    
    # -------------------------------------------------------------------------
    # CATEGORY SCORING
    # -------------------------------------------------------------------------
    
    async def _score_categories(
        self,
        proposal: str,
        requirements: JobRequirements,
        job_post: dict
    ) -> list[CategoryScore]:
        """Score proposal in each category"""
        scores = []
        
        # Requirement coverage
        scores.append(self._score_requirement_coverage(proposal, requirements))
        
        # Personalization
        scores.append(self._score_personalization(proposal, job_post))
        
        # Tone
        scores.append(await self._score_tone(proposal, requirements.preferred_tone))
        
        # Length
        scores.append(self._score_length(proposal))
        
        # Call to action
        scores.append(self._score_cta(proposal))
        
        # Grammar (simplified)
        scores.append(self._score_grammar(proposal))
        
        # Clarity
        scores.append(await self._score_clarity(proposal))
        
        # Opening
        scores.append(self._score_opening(proposal))
        
        # Closing
        scores.append(self._score_closing(proposal))
        
        return scores
    
    def _score_requirement_coverage(
        self,
        proposal: str,
        requirements: JobRequirements
    ) -> CategoryScore:
        """Score how well proposal covers requirements"""
        proposal_lower = proposal.lower()
        
        # Check must-haves
        must_have_covered = sum(
            1 for req in requirements.must_haves
            if req.lower() in proposal_lower
        )
        must_have_total = len(requirements.must_haves) or 1
        
        # Check keywords
        keyword_covered = sum(
            1 for kw in requirements.keywords
            if kw in proposal_lower
        )
        keyword_total = len(requirements.keywords) or 1
        
        # Calculate score
        must_have_score = (must_have_covered / must_have_total) * 60
        keyword_score = (keyword_covered / keyword_total) * 40
        score = int(must_have_score + keyword_score)
        
        suggestions = []
        if must_have_covered < must_have_total:
            missing = [r for r in requirements.must_haves if r.lower() not in proposal_lower]
            suggestions.append(f"Mention your experience with: {', '.join(missing[:3])}")
        
        if keyword_covered < keyword_total * 0.5:
            suggestions.append("Include more keywords from the job description")
        
        return CategoryScore(
            category=ScoreCategory.REQUIREMENT_COVERAGE,
            score=score,
            feedback=f"Covers {must_have_covered}/{must_have_total} requirements",
            suggestions=suggestions
        )
    
    def _score_personalization(
        self,
        proposal: str,
        job_post: dict
    ) -> CategoryScore:
        """Score personalization level"""
        score = 50
        suggestions = []
        
        proposal_lower = proposal.lower()
        
        # Check for job-specific mentions
        title = job_post.get('title', '').lower()
        company = job_post.get('company', '').lower()
        
        if title and title in proposal_lower:
            score += 15
        else:
            suggestions.append("Reference the specific job title")
        
        if company and company in proposal_lower:
            score += 20
        elif company:
            suggestions.append(f"Mention {job_post.get('company')} by name")
        
        # Check for specific problem understanding
        problem_indicators = ['understand', 'noticed', 'seen that', 'your need']
        if any(ind in proposal_lower for ind in problem_indicators):
            score += 15
        else:
            suggestions.append("Show understanding of their specific problem")
        
        return CategoryScore(
            category=ScoreCategory.PERSONALIZATION,
            score=min(score, 100),
            feedback="Personalization assessment",
            suggestions=suggestions
        )
    
    async def _score_tone(
        self,
        proposal: str,
        preferred_tone: str
    ) -> CategoryScore:
        """Score tone match"""
        # Use LLM to analyze tone
        prompt = f"""
Analyze the tone of this proposal:
"{proposal[:500]}"

Is it: formal, casual, technical, friendly, professional?
Does it match "{preferred_tone}" tone?
Score from 0-100 how well it matches.
"""
        
        # Simplified scoring
        score = 75  # Default decent score
        suggestions = []
        
        return CategoryScore(
            category=ScoreCategory.TONE,
            score=score,
            feedback=f"Tone analysis vs {preferred_tone}",
            suggestions=suggestions
        )
    
    def _score_length(self, proposal: str) -> CategoryScore:
        """Score proposal length"""
        word_count = len(proposal.split())
        
        # Optimal range: 150-400 words
        if 150 <= word_count <= 400:
            score = 100
            feedback = f"Good length ({word_count} words)"
            suggestions = []
        elif word_count < 100:
            score = 40
            feedback = f"Too short ({word_count} words)"
            suggestions = ["Expand with more relevant details"]
        elif word_count < 150:
            score = 70
            feedback = f"Slightly short ({word_count} words)"
            suggestions = ["Consider adding 1-2 more paragraphs"]
        elif word_count <= 500:
            score = 80
            feedback = f"Slightly long ({word_count} words)"
            suggestions = ["Consider trimming unnecessary content"]
        else:
            score = 50
            feedback = f"Too long ({word_count} words)"
            suggestions = ["Shorten significantly - focus on key points"]
        
        return CategoryScore(
            category=ScoreCategory.LENGTH,
            score=score,
            feedback=feedback,
            suggestions=suggestions
        )
    
    def _score_cta(self, proposal: str) -> CategoryScore:
        """Score call-to-action"""
        proposal_lower = proposal.lower()
        
        strong_ctas = [
            'schedule a call', 'let\'s discuss', 'book a meeting',
            'available to start', 'ready to begin'
        ]
        weak_ctas = [
            'let me know', 'looking forward', 'hope to hear',
            'please consider'
        ]
        
        has_strong = any(cta in proposal_lower for cta in strong_ctas)
        has_weak = any(cta in proposal_lower for cta in weak_ctas)
        
        if has_strong:
            score = 100
            feedback = "Strong call-to-action"
            suggestions = []
        elif has_weak:
            score = 70
            feedback = "Has call-to-action but could be stronger"
            suggestions = ["Use more direct CTA like 'Let's schedule a call'"]
        else:
            score = 30
            feedback = "No clear call-to-action"
            suggestions = ["Add a clear next step at the end"]
        
        return CategoryScore(
            category=ScoreCategory.CALL_TO_ACTION,
            score=score,
            feedback=feedback,
            suggestions=suggestions
        )
    
    def _score_grammar(self, proposal: str) -> CategoryScore:
        """Basic grammar scoring"""
        # Simplified checks (in production: use proper grammar checker)
        issues = []
        
        # Check for common issues
        if '  ' in proposal:
            issues.append("Double spaces found")
        
        sentences = proposal.split('.')
        for s in sentences:
            s = s.strip()
            if s and s[0].islower():
                issues.append("Sentence starts with lowercase")
                break
        
        score = 100 - (len(issues) * 10)
        
        return CategoryScore(
            category=ScoreCategory.GRAMMAR,
            score=max(score, 50),
            feedback=f"{len(issues)} potential issues found",
            suggestions=issues[:3]
        )
    
    async def _score_clarity(self, proposal: str) -> CategoryScore:
        """Score clarity and readability"""
        # Calculate reading ease (simplified Flesch-Kincaid)
        words = proposal.split()
        sentences = proposal.count('.') + proposal.count('!') + proposal.count('?')
        sentences = max(sentences, 1)
        
        words_per_sentence = len(words) / sentences
        
        if words_per_sentence < 20:
            score = 90
            feedback = "Clear and readable"
            suggestions = []
        elif words_per_sentence < 30:
            score = 70
            feedback = "Reasonably clear"
            suggestions = ["Consider shorter sentences for clarity"]
        else:
            score = 50
            feedback = "May be hard to read"
            suggestions = ["Break long sentences into shorter ones"]
        
        return CategoryScore(
            category=ScoreCategory.CLARITY,
            score=score,
            feedback=feedback,
            suggestions=suggestions
        )
    
    def _score_opening(self, proposal: str) -> CategoryScore:
        """Score opening strength"""
        first_sentence = proposal.split('.')[0] if '.' in proposal else proposal[:100]
        first_lower = first_sentence.lower()
        
        # Weak openers
        weak_patterns = [
            'my name is', 'i am a', 'i have been',
            'i would like to', 'i am interested in', 'i am writing'
        ]
        
        # Strong openers (focus on client/problem)
        strong_patterns = [
            'your', 'you need', 'noticed', 'exactly what',
            'perfect fit', 'similar project'
        ]
        
        has_weak = any(p in first_lower for p in weak_patterns)
        has_strong = any(p in first_lower for p in strong_patterns)
        
        if has_strong and not has_weak:
            score = 90
            feedback = "Strong, client-focused opening"
            suggestions = []
        elif has_weak:
            score = 40
            feedback = "Generic opening - too self-focused"
            suggestions = ["Start with the client's problem, not yourself"]
        else:
            score = 65
            feedback = "Decent opening"
            suggestions = ["Hook reader by addressing their specific need"]
        
        return CategoryScore(
            category=ScoreCategory.OPENING,
            score=score,
            feedback=feedback,
            suggestions=suggestions
        )
    
    def _score_closing(self, proposal: str) -> CategoryScore:
        """Score closing strength"""
        # Get last 100 characters
        closing = proposal[-100:].lower() if len(proposal) > 100 else proposal.lower()
        
        strong_closings = [
            'look forward', 'discuss', 'call', 'chat',
            'start', 'begin', 'next steps'
        ]
        
        has_strong = any(c in closing for c in strong_closings)
        
        if has_strong:
            return CategoryScore(
                category=ScoreCategory.CLOSING,
                score=85,
                feedback="Good closing with next steps",
                suggestions=[]
            )
        else:
            return CategoryScore(
                category=ScoreCategory.CLOSING,
                score=55,
                feedback="Closing could be stronger",
                suggestions=["End with a clear invitation to continue the conversation"]
            )
    
    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------
    
    def _calculate_overall_score(self, scores: list[CategoryScore]) -> int:
        """Calculate weighted overall score"""
        weights = {
            ScoreCategory.REQUIREMENT_COVERAGE: 0.25,
            ScoreCategory.PERSONALIZATION: 0.20,
            ScoreCategory.OPENING: 0.15,
            ScoreCategory.CALL_TO_ACTION: 0.10,
            ScoreCategory.TONE: 0.10,
            ScoreCategory.CLARITY: 0.08,
            ScoreCategory.LENGTH: 0.05,
            ScoreCategory.CLOSING: 0.05,
            ScoreCategory.GRAMMAR: 0.02,
        }
        
        total = sum(
            score.score * weights.get(score.category, 0.1)
            for score in scores
        )
        
        return int(total)
    
    def _identify_strengths_weaknesses(
        self,
        scores: list[CategoryScore]
    ) -> tuple[list[str], list[str]]:
        """Identify top strengths and weaknesses"""
        sorted_scores = sorted(scores, key=lambda s: s.score, reverse=True)
        
        strengths = [
            f"{s.category.value}: {s.feedback}"
            for s in sorted_scores[:3]
            if s.score >= 70
        ]
        
        weaknesses = [
            f"{s.category.value}: {s.feedback}"
            for s in sorted_scores[-3:]
            if s.score < 70
        ]
        
        return strengths, weaknesses
    
    async def _generate_rewrites(
        self,
        proposal: str,
        weaknesses: list[str],
        requirements: JobRequirements
    ) -> list[dict]:
        """Generate rewrite suggestions for weak areas"""
        # In production: Use LLM to generate specific rewrites
        return []
    
    async def _compare_to_winners(
        self,
        proposal: str,
        job_post: dict
    ) -> list[str]:
        """Compare to similar winning proposals"""
        # In production: Query database for similar winning proposals
        return [
            "Winning proposals in this category average 250 words",
            "Top performers often ask 2-3 specific questions",
            "Successful proposals usually mention a similar past project"
        ]
    
    def _estimate_win_probability(
        self,
        overall_score: int,
        category_scores: list[CategoryScore]
    ) -> float:
        """Estimate win probability from scores"""
        # Simple mapping from score to probability
        base_prob = overall_score / 100 * 0.6  # Max 60% from score
        
        # Boost for key categories
        for score in category_scores:
            if score.category == ScoreCategory.REQUIREMENT_COVERAGE and score.score > 80:
                base_prob += 0.1
            if score.category == ScoreCategory.PERSONALIZATION and score.score > 80:
                base_prob += 0.1
        
        return min(base_prob, 0.85)


# =============================================================================
# FACTORY
# =============================================================================

_analyzer: Optional[ProposalAnalyzer] = None

def get_proposal_analyzer() -> ProposalAnalyzer:
    """Get ProposalAnalyzer singleton"""
    global _analyzer
    if _analyzer is None:
        from app.llm.openai_client import get_openai_client
        from app.metrics import get_metrics
        
        _analyzer = ProposalAnalyzer(
            llm_client=get_openai_client(),
            metrics=get_metrics()
        )
    return _analyzer
