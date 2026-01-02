'use client';

/**
 * Proposal Assistant Component
 * AI-powered proposal writing assistance
 * Sprint M7: AI Work Assistant
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Lightbulb,
  Target,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Wand2,
  Eye,
  Copy,
  ArrowRight,
  X,
} from 'lucide-react';
import { cn } from '@skillancer/ui';

// =============================================================================
// TYPES
// =============================================================================

interface JobAnalysis {
  requirements: string[];
  priorities: string[];
  budgetSignals: {
    range: { min: number; max: number } | null;
    flexibility: 'rigid' | 'flexible' | 'unknown';
  };
  clientTone: 'formal' | 'casual' | 'technical';
  keyTerms: string[];
}

interface ProposalSuggestion {
  id: string;
  type: 'opening' | 'body' | 'closing' | 'improvement';
  text: string;
  confidence: number;
  reasoning: string;
}

interface ProposalScore {
  overall: number;
  categories: {
    name: string;
    score: number;
    feedback: string;
  }[];
  strengths: string[];
  improvements: string[];
}

interface ProposalAssistantProps {
  jobDescription: string;
  proposalText: string;
  onSuggestionApply: (suggestion: string) => void;
  freelancerProfile?: {
    skills: string[];
    experience: string;
    portfolioHighlights: string[];
  };
  className?: string;
}

// =============================================================================
// HOOKS
// =============================================================================

function useProposalAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeJob = async (description: string): Promise<JobAnalysis> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/proposals/analyze-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      if (!response.ok) throw new Error('Failed to analyze job');
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const generateSuggestions = async (
    jobDescription: string,
    currentProposal: string,
    profile?: { skills: string[]; experience: string; portfolioHighlights: string[] }
  ): Promise<ProposalSuggestion[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/proposals/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, currentProposal, profile }),
      });
      if (!response.ok) throw new Error('Failed to generate suggestions');
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const scoreProposal = async (
    proposal: string,
    jobDescription: string
  ): Promise<ProposalScore> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/proposals/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal, jobDescription }),
      });
      if (!response.ok) throw new Error('Failed to score proposal');
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scoring failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const submitFeedback = async (
    suggestionId: string,
    helpful: boolean,
    applied: boolean
  ): Promise<void> => {
    try {
      await fetch('/api/ai/proposals/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, helpful, applied }),
      });
    } catch (err) {
      console.error('Failed to submit feedback', err);
    }
  };

  return {
    analyzeJob,
    generateSuggestions,
    scoreProposal,
    submitFeedback,
    isLoading,
    error,
  };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ScoreIndicator({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const getColor = () => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const sizes = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-xl',
    lg: 'w-20 h-20 text-2xl',
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full border-4',
        sizes[size],
        score >= 80 && 'border-green-500',
        score >= 60 && score < 80 && 'border-yellow-500',
        score < 60 && 'border-red-500'
      )}
    >
      <span className={cn('font-bold', getColor())}>{score}</span>
    </div>
  );
}

function CategoryScore({
  name,
  score,
  feedback,
}: {
  name: string;
  score: number;
  feedback: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 py-2 last:border-0">
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm font-medium text-gray-700">{name}</span>
        <div className="flex items-center gap-2">
          <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                score >= 80 && 'bg-green-500',
                score >= 60 && score < 80 && 'bg-yellow-500',
                score < 60 && 'bg-red-500'
              )}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="w-8 text-right text-sm text-gray-500">{score}</span>
          <ChevronRight
            className={cn('h-4 w-4 text-gray-400 transition-transform', expanded && 'rotate-90')}
          />
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 text-sm text-gray-500"
          >
            {feedback}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onApply,
  onFeedback,
}: {
  suggestion: ProposalSuggestion;
  onApply: (text: string) => void;
  onFeedback: (id: string, helpful: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(suggestion.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (helpful: boolean) => {
    setFeedbackGiven(helpful ? 'up' : 'down');
    onFeedback(suggestion.id, helpful);
  };

  const typeLabels = {
    opening: 'Opening',
    body: 'Body Content',
    closing: 'Closing',
    improvement: 'Improvement',
  };

  const typeColors = {
    opening: 'bg-blue-100 text-blue-700',
    body: 'bg-purple-100 text-purple-700',
    closing: 'bg-green-100 text-green-700',
    improvement: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            typeColors[suggestion.type]
          )}
        >
          {typeLabels[suggestion.type]}
        </span>
        <span className="text-xs text-gray-400">
          {Math.round(suggestion.confidence * 100)}% confident
        </span>
      </div>

      <p className="mb-3 text-sm text-gray-700">{suggestion.text}</p>

      <div className="mb-3 rounded bg-gray-50 p-2">
        <p className="text-xs text-gray-500">
          <Lightbulb className="mr-1 inline h-3 w-3" />
          {suggestion.reasoning}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => handleFeedback(true)}
            className={cn(
              'rounded p-1.5 hover:bg-gray-100',
              feedbackGiven === 'up' && 'bg-green-100 text-green-600'
            )}
            disabled={feedbackGiven !== null}
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleFeedback(false)}
            className={cn(
              'rounded p-1.5 hover:bg-gray-100',
              feedbackGiven === 'down' && 'bg-red-100 text-red-600'
            )}
            disabled={feedbackGiven !== null}
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => onApply(suggestion.text)}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
          >
            <ArrowRight className="h-4 w-4" />
            Apply
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function JobInsightsPanel({ analysis }: { analysis: JobAnalysis }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h4 className="mb-3 flex items-center gap-2 font-medium text-blue-800">
        <Eye className="h-4 w-4" />
        Job Insights
      </h4>

      <div className="space-y-3">
        <div>
          <span className="text-xs font-medium uppercase text-blue-600">Key Requirements</span>
          <ul className="mt-1 space-y-1">
            {analysis.requirements.slice(0, 3).map((req, i) => (
              <li key={i} className="flex items-start gap-1 text-sm text-blue-900">
                <Target className="mt-0.5 h-3 w-3 flex-shrink-0" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <span className="text-xs font-medium uppercase text-blue-600">Client Priorities</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {analysis.priorities.map((priority, i) => (
              <span key={i} className="rounded bg-blue-200 px-2 py-0.5 text-xs text-blue-800">
                {priority}
              </span>
            ))}
          </div>
        </div>

        {analysis.budgetSignals.range && (
          <div>
            <span className="text-xs font-medium uppercase text-blue-600">Budget Signals</span>
            <p className="mt-1 text-sm text-blue-900">
              ${analysis.budgetSignals.range.min.toLocaleString()} - $
              {analysis.budgetSignals.range.max.toLocaleString()}
              <span className="ml-1 text-xs text-blue-600">
                ({analysis.budgetSignals.flexibility})
              </span>
            </p>
          </div>
        )}

        <div>
          <span className="text-xs font-medium uppercase text-blue-600">Tone</span>
          <p className="mt-1 text-sm capitalize text-blue-900">{analysis.clientTone}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ProposalAssistant({
  jobDescription,
  proposalText,
  onSuggestionApply,
  freelancerProfile,
  className,
}: ProposalAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'analyze' | 'suggestions' | 'score'>('analyze');
  const [jobAnalysis, setJobAnalysis] = useState<JobAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<ProposalSuggestion[]>([]);
  const [score, setScore] = useState<ProposalScore | null>(null);

  const { analyzeJob, generateSuggestions, scoreProposal, submitFeedback, isLoading, error } =
    useProposalAI();

  // Auto-analyze when job description changes
  useEffect(() => {
    if (jobDescription && jobDescription.length > 50) {
      const timeout = setTimeout(() => {
        handleAnalyze();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [jobDescription]);

  const handleAnalyze = async () => {
    if (!jobDescription) return;
    try {
      const analysis = await analyzeJob(jobDescription);
      setJobAnalysis(analysis);
    } catch (err) {
      console.error('Failed to analyze job', err);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!jobDescription) return;
    try {
      const newSuggestions = await generateSuggestions(
        jobDescription,
        proposalText,
        freelancerProfile
      );
      setSuggestions(newSuggestions);
      setActiveTab('suggestions');
    } catch (err) {
      console.error('Failed to generate suggestions', err);
    }
  };

  const handleScoreProposal = async () => {
    if (!proposalText || !jobDescription) return;
    try {
      const newScore = await scoreProposal(proposalText, jobDescription);
      setScore(newScore);
      setActiveTab('score');
    } catch (err) {
      console.error('Failed to score proposal', err);
    }
  };

  const handleApplySuggestion = useCallback(
    (text: string) => {
      onSuggestionApply(text);
      // Find the suggestion and record it was applied
      const suggestion = suggestions.find((s) => s.text === text);
      if (suggestion) {
        submitFeedback(suggestion.id, true, true);
      }
    },
    [suggestions, onSuggestionApply, submitFeedback]
  );

  const handleFeedback = useCallback(
    (id: string, helpful: boolean) => {
      submitFeedback(id, helpful, false);
    },
    [submitFeedback]
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100',
          className
        )}
      >
        <Sparkles className="h-4 w-4" />
        AI Proposal Assistant
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-xl border border-gray-200 bg-white shadow-lg', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600" />
          <span className="font-semibold text-gray-900">AI Proposal Assistant</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="rounded p-1 hover:bg-gray-100">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 border-b border-gray-100 px-4 py-3">
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !jobDescription}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'analyze'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Eye className="h-4 w-4" />
          Analyze Job
        </button>
        <button
          onClick={handleGenerateSuggestions}
          disabled={isLoading || !jobDescription}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'suggestions'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Wand2 className="h-4 w-4" />
          Get Suggestions
        </button>
        <button
          onClick={handleScoreProposal}
          disabled={isLoading || !proposalText}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === 'score'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Target className="h-4 w-4" />
          Score Proposal
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto p-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-gray-600">Analyzing...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {!isLoading && !error && activeTab === 'analyze' && jobAnalysis && (
          <JobInsightsPanel analysis={jobAnalysis} />
        )}

        {!isLoading && !error && activeTab === 'suggestions' && (
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                Click "Get Suggestions" to generate AI-powered proposal ideas
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApply={handleApplySuggestion}
                  onFeedback={handleFeedback}
                />
              ))
            )}
          </div>
        )}

        {!isLoading && !error && activeTab === 'score' && score && (
          <div className="space-y-4">
            {/* Overall Score */}
            <div className="flex items-center gap-4">
              <ScoreIndicator score={score.overall} size="lg" />
              <div>
                <h4 className="font-semibold text-gray-900">Overall Score</h4>
                <p className="text-sm text-gray-500">
                  {score.overall >= 80
                    ? 'Excellent proposal!'
                    : score.overall >= 60
                      ? 'Good, but has room for improvement'
                      : 'Needs significant improvements'}
                </p>
              </div>
            </div>

            {/* Category Scores */}
            <div className="rounded-lg border border-gray-200 p-3">
              <h5 className="mb-2 text-sm font-medium text-gray-700">Category Breakdown</h5>
              {score.categories.map((cat) => (
                <CategoryScore key={cat.name} {...cat} />
              ))}
            </div>

            {/* Strengths & Improvements */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-green-50 p-3">
                <h5 className="mb-2 flex items-center gap-1 text-sm font-medium text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  Strengths
                </h5>
                <ul className="space-y-1">
                  {score.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-green-800">
                      • {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3">
                <h5 className="mb-2 flex items-center gap-1 text-sm font-medium text-yellow-700">
                  <AlertCircle className="h-4 w-4" />
                  Improvements
                </h5>
                <ul className="space-y-1">
                  {score.improvements.map((i, idx) => (
                    <li key={idx} className="text-sm text-yellow-800">
                      • {i}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && !jobAnalysis && !suggestions.length && !score && (
          <div className="py-8 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-indigo-300" />
            <p className="text-gray-600">Let AI help you write a winning proposal</p>
            <p className="mt-1 text-sm text-gray-400">
              Start by analyzing the job description above
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ProposalAssistant;
